import { mat4 } from 'gl-matrix';


/* Credits to Matt Keeter for this approach https://www.mattkeeter.com/projects/swingline/ */
const centroidVertexShader = `#version 300 es
    in vec3 vertexPosition;
    uniform mat4 modelViewMatrix;

    void main(void) {
        gl_Position =  modelViewMatrix * vec4(vertexPosition, 1.0);
    }
`;

const centroidFragmentShader = `#version 300 es
    precision highp float;
    
    uniform sampler2D imageSampler;
    uniform sampler2D voronoiSampler;
    uniform vec2 windowDimensions;

    out vec4 sum;

      void main(void) {
        // GLES3.0 is missing layout qualifiers for rounded down fragcoord so round down manually
        vec4 screen_coords = vec4(floor(gl_FragCoord.x), floor(gl_FragCoord.y), floor(gl_FragCoord.z), floor(gl_FragCoord.w));
        
        int thisIndex = int(screen_coords.x);
        ivec2 texSize = textureSize(voronoiSampler, 0);
        sum = vec4(0.0, 0.0, 0.0, 0.0);

        for(int x = 0; x < texSize.x ; x++){
            ivec2 texCoord = ivec2(x, int(screen_coords.y));
            vec4 voronoiTexel = texelFetch(voronoiSampler, texCoord, 0);

            int currentVoronoiIndex = int(255.0f * (voronoiTexel.x + (voronoiTexel.y * 256.0f) + (voronoiTexel.z * 65536.0f)));

            if(currentVoronoiIndex == thisIndex){
                vec4 imageTexel = texelFetch(imageSampler, texCoord, 0);
                float weight = 1.0 - 0.299* imageTexel.x - 0.587 * imageTexel.y - 0.114 * imageTexel.z;
                weight = 0.01 + weight * 0.99; // give minum weight to avoid divide by zero
                weight = 1.0; // For debugging, if we set weight to 1.0 it should spread out evenly

                sum.x += (float(x) + 0.5) * weight;
                sum.y += (screen_coords.y + 0.5) * weight;
                sum.z += weight;
                sum.w += 1.0;
            }
        }
        sum.x /= float(texSize.x);
        sum.y /= float(texSize.y);
    }
`;

const outputVertexShader = `#version 300 es
    precision highp float;

    uniform sampler2D intermediateSampler;
    uniform vec2 windowDimensions;
    uniform float voronoiUpscaleConstant;

    in float outputIndex;

    out vec3 centroidPos;

    void main(void) {
        ivec2 texSize = textureSize(intermediateSampler, 0);

        float weight = 0.0;
        float count = 0.0;

        /* Accumulate summing over columns */
        float ix = 0.0;
        float iy = 0.0;

        centroidPos = vec3(0.0f, 0.0f, 0.0f);

        for(int y = 0; y < texSize.y; y++){
            ivec2 texCoord = ivec2(int(outputIndex), y);
            vec4 intermediateTexel = texelFetch(intermediateSampler, texCoord, 0);

            ix += intermediateTexel.x;
            iy += intermediateTexel.y;
            weight += intermediateTexel.z; 
            count += intermediateTexel.w;
        }
        ix /= weight;
        iy /= weight;
        weight /= count;

        centroidPos = vec3(
            ix * 2.0 - 1.0,
            iy * 2.0 - 1.0,
            0
        );

    }
`;

/* intel drivers have no default fragment shader for feedback transforms 
 * http://stackoverflow.com/questions/38712224/is-fragment-shader-necessary-in-intel-hd-graphic-card */
const blankFragmentShader = `#version 300 es
    precision highp float;
    out vec4 outputColor;

    void main(void) {
        outputColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
`;



const voronoiVertexShader  = `#version 300 es
    precision highp float;
    layout (location = 0) in vec2 instancedPosition;
    layout (location = 1) in vec3 vertexPosition;

    out vec3 indexAsColor;

    void main(void) {
        gl_Position = vec4(vertexPosition.xy + instancedPosition, vertexPosition.z, 1.0f);
        indexAsColor = vec3(
            float(gl_InstanceID % 256) / 255.0f, 
            float((gl_InstanceID / 256) % 256) /255.0f, 
            float((gl_InstanceID / 65536) % 256) /255.0f);
    }
`;

const voronoiFragmentShader = `#version 300 es
    precision highp float;
    
    in vec3 indexAsColor;
    out vec4 outputColor;

    void main(void) { 
        outputColor =  vec4(indexAsColor, 1.0);
    }
`;

const finalOutputFragmentShader = `#version 300 es
    precision highp float;
    
    in vec3 indexAsColor;
    out vec4 outputColor;

    void main(void) { 
        outputColor =  vec4(0.0, 0.0, 0.0, 1.0);
    }
`;

const finalOutputVertexShader  = `#version 300 es
    precision highp float;
    layout (location = 0) in vec2 instancedPosition;
    layout (location = 1) in vec3 vertexPosition;

    out vec3 indexAsColor;

    void main(void) {
        gl_Position = vec4(vertexPosition.xy + 0.05 * instancedPosition, vertexPosition.z, 1.0f);
        indexAsColor = vec3(
            float(gl_InstanceID % 256) / 255.0f, 
            float((gl_InstanceID / 256) % 256) /255.0f, 
            float((gl_InstanceID / 65536) % 256) /255.0f);
    }
`;

/**
 * Utility for generating offscreen Voroni Diagrams
 */
class VoroniRenderer{
    /**
     * @param {Number} Samples
     * @param {Boolean} debug
     */
    constructor(samples, iterations, debug){
        this.imageLoaded = false;
        this.debug = debug;
        this.iterations = iterations;
        this.samples = samples;
        this._init();
    }

    _onReady(){
        this._enableExtensions();
        this._genInitialData();
        this._initGL();
        this.tick();
    }
    _init(){
        this.coneResolution = 100;
        /* Init offscreen canvas */
        this.canvas = document.createElement("canvas"); 
        this.canvas.width = 0;
        this.canvas.height = 1;

        this.gl = this.canvas.getContext('webgl2', {preserveDrawingBuffer: true, antialias: false});
        this.textures = {};
        this.buffers = {};
        this.centroid = {attributes: {}, uniforms: {}};
        this.voronoi = {attributes: {}, uniforms: {}};
        this.output = {attributes: {}, uniforms: {}};
        this.finalOutput = {attributes: {}, uniforms: {}};
        this.frameBuffers = {};
        this.voronoiUpscaleConstant = 10; //supersampling
        this._loadImage(() => this._onReady());
    }
    _enableExtensions(){
        const float_texture_ext = this.gl.getExtension('EXT_color_buffer_float');
        if(!float_texture_ext){
            console.error("This requires the EXT_color_buffer_float extension to operate!");
        } 
    }
    _initGL(){
        this.canvas.width = Math.max(this.inputImage.width * this.voronoiUpscaleConstant, this.samples);
        this.canvas.height = this.inputImage.height* this.voronoiUpscaleConstant;

        this._initShaders();

        /* Create Uniforms/Attributes*/
        this._getUniformLocations();
        this._getAttributeLocations();
        this._getBuffers();

        /* Bind data*/
        this._bindDataToBuffers();

        /* Setup Textures */
        this._initImageAsTexture();

        /* Setup Framebuffers*/
        this._initFrameBuffers();

        /* GL state toggles*/
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
    }
    _loadImage(callback){
        this.inputImage = new Image();
        this.inputImage.src = "static/cat.jpg";
        this.inputImage.onload = () => {
            this.imageLoaded = true;
            callback();
        }
    }
    
    _initFrameBuffers(){
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.textures.voronoiTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.voronoiTexture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.inputImage.width * this.voronoiUpscaleConstant, this.inputImage.height * this.voronoiUpscaleConstant, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
        
        this.frameBuffers.voronoi = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffers.voronoi);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.textures.voronoiTexture, 0);

        /* Voronoi diagram needs a depthbuffer because of how the cone algorithm works */
        const renderbuffer = this.gl.createRenderbuffer();
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, renderbuffer);
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT32F, this.inputImage.width * this.voronoiUpscaleConstant, this.inputImage.height * this.voronoiUpscaleConstant);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.textures.voronoiTexture, 0);
        this.gl.framebufferRenderbuffer(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.RENDERBUFFER, renderbuffer);

        
        this.gl.activeTexture(this.gl.TEXTURE2);
        this.textures.intermediateTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.intermediateTexture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA32F, this.samples, this.inputImage.height  * this.voronoiUpscaleConstant, 0, this.gl.RGBA, this.gl.FLOAT, null);
        
        this.frameBuffers.intermediate = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffers.intermediate);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.textures.intermediateTexture, 0);
    }

    _initImageAsTexture(){
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.textures.imageTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.imageTexture);
        //this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.RGBA,
            this.gl.RGBA,
            this.gl.UNSIGNED_BYTE,
            this.inputImage,
        );
        /* no texelfetch */
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST );
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST );
        /* npt textures */
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE );
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE );
    }

    /**
     * Binds string as a shader to the gl context.
     * @param {String} str The string to be bound as a shader.
     * @param {Number} shaderType Either gl.vertexShader or gl.fragmentShader
     * @return {WebGLShader} Newly bound shader.
    */
    _getShader(str, shaderType){
        const shader = this.gl.createShader(shaderType);
        
        this.gl.shaderSource(shader, str);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
          console.error(this.gl.getShaderInfoLog(shader));
          return null;
        }
        return shader;
    }

    /**
     * Initializes the shader program
     */
    _initShaders(){
        this._initCentroidProgram();
        this._initVoronoiProgram();
        this._initOutputProgram();
        this._initFinalOutputProgram();
    }

    _initCentroidProgram(){
        /* Create shaders and shader program */
        const vertexShader = this._getShader(centroidVertexShader, this.gl.VERTEX_SHADER);
        const fragmentShader = this._getShader(centroidFragmentShader, this.gl.FRAGMENT_SHADER);

        this.centroid.shaderProgram = this.gl.createProgram();
        
        this.gl.attachShader(this.centroid.shaderProgram, vertexShader);
        this.gl.attachShader(this.centroid.shaderProgram, fragmentShader);
        this.gl.linkProgram(this.centroid.shaderProgram);

        if(!this.gl.getProgramParameter(this.centroid.shaderProgram, this.gl.LINK_STATUS)){
          console.error("Could not init centroid shaders.");
          return null;
        }
    }

    _initOutputProgram(){
        /* Create shaders and shader program */
        const vertexShader = this._getShader(outputVertexShader, this.gl.VERTEX_SHADER);
        const fragmentShader = this._getShader(blankFragmentShader, this.gl.FRAGMENT_SHADER);

        this.output.shaderProgram = this.gl.createProgram();

        this.gl.attachShader(this.output.shaderProgram, vertexShader);
        this.gl.attachShader(this.output.shaderProgram, fragmentShader);

        /* Capture output in feedback buffer */
        this.gl.transformFeedbackVaryings(this.output.shaderProgram, ['centroidPos'], this.gl.INTERLEAVED_ATTRIBS);

        this.gl.linkProgram(this.output.shaderProgram);

        if(!this.gl.getProgramParameter(this.output.shaderProgram, this.gl.LINK_STATUS)){
          console.error("Could not init output shaders.");
          return null;
        }
    }

    _initVoronoiProgram(){
        const vertexShader = this._getShader(voronoiVertexShader, this.gl.VERTEX_SHADER);
        const fragmentShader = this._getShader(voronoiFragmentShader, this.gl.FRAGMENT_SHADER);

        this.voronoi.shaderProgram = this.gl.createProgram();
        
        this.gl.attachShader(this.voronoi.shaderProgram, vertexShader);
        this.gl.attachShader(this.voronoi.shaderProgram, fragmentShader);
        this.gl.linkProgram(this.voronoi.shaderProgram);

        if(!this.gl.getProgramParameter(this.voronoi.shaderProgram, this.gl.LINK_STATUS)){
          console.error("Could not init voronoi shaders.");
          return null;
        }
    }

    _initFinalOutputProgram(){
        const vertexShader = this._getShader(finalOutputVertexShader, this.gl.VERTEX_SHADER);
        const fragmentShader = this._getShader(finalOutputFragmentShader, this.gl.FRAGMENT_SHADER);

        this.finalOutput.shaderProgram = this.gl.createProgram();
        
        this.gl.attachShader(this.finalOutput.shaderProgram, vertexShader);
        this.gl.attachShader(this.finalOutput.shaderProgram, fragmentShader);
        this.gl.linkProgram(this.finalOutput.shaderProgram);

        if(!this.gl.getProgramParameter(this.finalOutput.shaderProgram, this.gl.LINK_STATUS)){
          console.error("Could not init voronoi shaders.");
          return null;
        }
    }

    /**
     * Create quad
     * @param {Number} x x-coordinate of the center on the current coordinate system
     * @param {Number} y x-coordinate of the center on the current coordinate system
     * @param {Number} edges The number of edges for the base to have (not the total)
     * @return {???} 
    */
    _createQuad(x, y, edges){
        return [
            -1.0, -1.0, -1.0,
            -1.0, 1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, 1.0, -1.0,
        ];
    }

    /**
     * Creates cone with the given number of edges parametrically.
     * @param {Number} x x-coordinate of the center on the current coordinate system
     * @param {Number} y x-coordinate of the center on the current coordinate system
     * @param {Number} edges The number of edges for the base to have (not the total)
     * @return {???} 
    */
    _createCone(x, y, edges){
        const pi = Math.PI;
        const vertices = new Array(edges*(3+2));
        
        /* Center of cone */
        vertices[0] = x;
        vertices[1] = y;
        vertices[2] = -1;
        
        for(let i = 1 ; i <= edges+2; i++){
            const ratio = i/edges;
            vertices[i*3] = (x + Math.sin(2 * pi * ratio));
            vertices[i*3+1] = (y + Math.cos(2 * pi * ratio));
            vertices[i*3+2] = -0.5;
        }
        return vertices;
    }
    /**
     * Inserts attribute locations into this.centroid.attributes
     */
    _getAttributeLocations(){
        this.voronoi.attributes.instancedPosition = this.gl.getAttribLocation(this.voronoi.shaderProgram, "instancedPosition");
        this.gl.enableVertexAttribArray(this.voronoi.attributes.instancedPosition);

        this.finalOutput.attributes.instancedPosition = this.gl.getAttribLocation(this.finalOutput.shaderProgram, "instancedPosition");
        this.gl.enableVertexAttribArray(this.finalOutput.attributes.instancedPosition);

        this.output.attributes.outputIndex = this.gl.getAttribLocation(this.output.shaderProgram, "outputIndex");
        this.gl.enableVertexAttribArray(this.output.attributes.outputIndex);

        this.voronoi.attributes.vertexPosition = this.gl.getAttribLocation(this.voronoi.shaderProgram, "vertexPosition");
        this.gl.enableVertexAttribArray(this.voronoi.attributes.vertexPosition);

        this.centroid.attributes.vertexPosition = this.gl.getAttribLocation(this.centroid.shaderProgram, "vertexPosition");
        this.gl.enableVertexAttribArray(this.centroid.attributes.vertexPosition);

        this.finalOutput.attributes.vertexPosition = this.gl.getAttribLocation(this.finalOutput.shaderProgram, "vertexPosition");
        this.gl.enableVertexAttribArray(this.finalOutput.attributes.vertexPosition);
    }

    /**
     * Inserts uniform locations into this.centroid.attributes
     */
    _getUniformLocations(){
         this.centroid.uniforms.modelViewMatrix = this.gl.getUniformLocation(this.centroid.shaderProgram, "modelViewMatrix");
         this.centroid.uniforms.imageSampler = this.gl.getUniformLocation(this.centroid.shaderProgram, "imageSampler");
         this.centroid.uniforms.voronoiSampler = this.gl.getUniformLocation(this.centroid.shaderProgram, "voronoiSampler");
         this.centroid.uniforms.windowDimensions = this.gl.getUniformLocation(this.centroid.shaderProgram, "windowDimensions");

         this.output.uniforms.modelViewMatrix = this.gl.getUniformLocation(this.output.shaderProgram, "modelViewMatrix");
         this.output.uniforms.intermediateSampler = this.gl.getUniformLocation(this.output.shaderProgram, "intermediateSampler");
         this.output.uniforms.windowDimensions = this.gl.getUniformLocation(this.output.shaderProgram, "windowDimensions");
         this.output.uniforms.voronoiUpscaleConstant = this.gl.getUniformLocation(this.output.shaderProgram, "voronoiUpscaleConstant");

         this.voronoi.uniforms.modelViewMatrix = this.gl.getUniformLocation(this.voronoi.shaderProgram, "modelViewMatrix");
         this.voronoi.uniforms.vertexColor = this.gl.getUniformLocation(this.voronoi.shaderProgram, "vertexColor");

         this.finalOutput.uniforms.modelViewMatrix = this.gl.getUniformLocation(this.finalOutput.shaderProgram, "modelViewMatrix");
         this.finalOutput.uniforms.vertexColor = this.gl.getUniformLocation(this.finalOutput.shaderProgram, "vertexColor");
    }

    /**
     * Gets buffers and inserts them into this.buffers
     */
    _getBuffers(){
        this.buffers.quadPositionBuffer = this.gl.createBuffer();
        this.buffers.conePositionBuffer = this.gl.createBuffer();
        this.buffers.instancedPositionBuffer = this.gl.createBuffer();
        this.buffers.outputIndiceBuffer = this.gl.createBuffer();
    }

    /**
     * Generates geometry and color data then binds it to the appropriate buffers
     */
    _bindDataToBuffers(){
        /* Bind Quad Data*/
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.quadPositionBuffer);
        const quadVertices = this._createQuad();
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(quadVertices), this.gl.STATIC_DRAW);

        /* Bind Instanced Cone Positions */
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.instancedPositionBuffer);
        const points = [];
        this.points.forEach(point => {
            points.push(point.x / this.inputImage.width * 2.0 - 1);
            points.push(point.y / this.inputImage.height * 2.0 - 1);
            points.push(0);
        });

        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(points), this.gl.STATIC_DRAW);

        /* Bind Cone Data*/
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.conePositionBuffer);
        const coneVertices = this._createCone(0, 0, this.coneResolution);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(coneVertices), this.gl.STATIC_DRAW);

        /* Bind output indice data*/
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.outputIndiceBuffer);
        const indices = (new Array(this.samples).fill(1)).map((item, idx) => idx);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Uint32Array(indices), this.gl.STATIC_DRAW);
    }

    tick(){
        this.iterations--;
        if(this.iterations > 0){
            console.log(`${this.iterations} iterations left`);
            setTimeout(() => requestAnimationFrame(() => this.tick(), 1000));
            this.render();

            const savePoints = this.points;
            
            /* Render voronoi as we go */
            this._renderVoronoi(null);
        }
        else{
            this._drawPointsOntoCanvas();
        }
    }

    _debugFindCentroidsOnCPU(){
        const pixels = new Uint8Array(this.inputImage.width * this.inputImage.height * 4 * this.voronoiUpscaleConstant * this.voronoiUpscaleConstant);
        const imgd = this.gl.readPixels(0, 0, this.inputImage.width * this.voronoiUpscaleConstant, this.inputImage.height * this.voronoiUpscaleConstant, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
        let sumweight = 0;
        for(let i = 0; i < this.samples; i++){
            
            let sumX = 0;
            let sumY = 0;
            let ct = 0;
            for (let x = 0; x < this.inputImage.width * this.voronoiUpscaleConstant; x++){
                for (let y = 0; y < this.inputImage.height * this.voronoiUpscaleConstant; y++){
                    const pixelR = pixels[(x + this.inputImage.height * this.voronoiUpscaleConstant * y) * 4];
                    const pixelG = pixels[(x + this.inputImage.height * this.voronoiUpscaleConstant * y)*4+2];
                    const pixelB = pixels[(x + this.inputImage.height * this.voronoiUpscaleConstant * y)*4+3];
                    if(pixelR === i){
                        ct ++;
                        sumX += x;
                        sumY += y;
                    }
                }   
            }
            //console.log('x', sumX / ct);
            //console.log('y', sumY / ct);
            console.log(this.points[i].x - sumX/ ct /this.voronoiUpscaleConstant);
            this.points[i] = {x: sumX / ct / this.voronoiUpscaleConstant, y: sumY / ct / this.voronoiUpscaleConstant, weight: 100};

        }
    }

    _drawPointsOntoCanvas(){
        this._renderFinalOutput();
    }

    _updatePointsFromCurrentFramebuffer(){
        const pixels = new Uint8Array(this.samples * 4);
        const imgd = this.gl.readPixels(0, 0, this.samples, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
        let sumweight = 0;
        for(let i = 0; i < this.samples; i++){
            const point = this.points[i];
            const extraBitsX = pixels[i*4+2];
            const extraBitsY = pixels[i*4+3];
            const centroidX = pixels[i*4] + (extraBitsX/256) ;
            const centroidY = pixels[i*4+1] + (extraBitsY/256) ;
            //console.log(centroidX);
            //console.log(centroidY);
            this.points[i] = {x: centroidX, y: centroidY, weight: 100 };
        }
    }

    /* Generates intial data with rejection sampling */
    _genInitialData(){
        this.points = [];
        /* Use temporary canvas to load image to get luminesence values.*/
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.inputImage.width * this.voronoiUpscaleConstant;
        tempCanvas.height = this.inputImage.height * this.voronoiUpscaleConstant;

        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(this.inputImage, 0, 0);
        const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        let i = 0;
        while(i < this.samples){
            const x = Math.random() * this.inputImage.width;
            const y = Math.random() * this.inputImage.height;
            const index = x * 4 + y * tempCanvas.width * 4;
            const red = imageData.data[ Math.floor(x) * 4 + Math.floor(y) * tempCanvas.width * 4];
            if(Math.random() * 256 > red){
                this.points.push({x, y, weight: 1});
                i++;
            }
        }
    }

    /**
     * Encodes an int as a OpenGL formatted float.
     * @param {Number} i Must be a whole number
     * @return {Float32Array} A 3 dimensional array representing i
    */
    _encodeIntToRGB(i){
        const r = i % 256;
        const g = Math.floor( i / 256 ) % 256;
        const b = Math.floor( i / 65536 ) % 256;
        return new Float32Array([r / 255.0, g / 255.0 , b /255.0]);
    }

    _renderFinalOutput(){
        this.gl.useProgram(this.finalOutput.shaderProgram);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        /* Render Voronoi to framebuffer */
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.inputImage.width, this.inputImage.height);

        /* Bind instanced positions*/
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.instancedPositionBuffer);
        this.gl.vertexAttribPointer(this.finalOutput.attributes.instancedPosition, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.vertexAttribDivisor(this.finalOutput.attributes.instancedPosition, 1);

        /* Bind Cone */
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.conePositionBuffer);
        this.gl.vertexAttribPointer(this.finalOutput.attributes.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.vertexAttribDivisor(this.finalOutput.attributes.vertexPosition, 0);

        this.gl.drawArraysInstanced(this.gl.TRIANGLE_FAN, 0, this.coneResolution+2, this.samples);
        
        /* this was originally done in webgl 1.0 which has no vaos */
        this.gl.vertexAttribDivisor(this.voronoi.attributes.instancedPosition, 0);
    }
    
    /**
     * Encodes the current points as a Voronoi diagram into the framebuffer.
    */
    _renderVoronoi(framebuffer){
        this.gl.useProgram(this.voronoi.shaderProgram);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        /* Render Voronoi to framebuffer */
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
        this.gl.viewport(0, 0, this.inputImage.width * this.voronoiUpscaleConstant, this.inputImage.height * this.voronoiUpscaleConstant);

        /* Bind instanced positions*/
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.instancedPositionBuffer);
        this.gl.vertexAttribPointer(this.voronoi.attributes.instancedPosition, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.vertexAttribDivisor(this.voronoi.attributes.instancedPosition, 1);

        /* Bind Cone */
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.conePositionBuffer);
        this.gl.vertexAttribPointer(this.voronoi.attributes.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.vertexAttribDivisor(this.voronoi.attributes.vertexPosition, 0);

        this.gl.drawArraysInstanced(this.gl.TRIANGLE_FAN, 0, this.coneResolution+2, this.samples);
        
        /* this was originally done in webgl 1.0 which has no vaos */
        this.gl.vertexAttribDivisor(this.voronoi.attributes.instancedPosition, 0);
    }

    _debugRenderVoronoiCenters(color){
        this.gl.useProgram(this.voronoi.shaderProgram);
        this.gl.clear(this.gl.DEPTH_BUFFER_BIT);

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.inputImage.width * this.voronoiUpscaleConstant , this.inputImage.height * this.voronoiUpscaleConstant);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.conePositionBuffer);
        this.gl.vertexAttribPointer(this.voronoi.attributes.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);

        this.gl.uniform3f(this.voronoi.uniforms.vertexColor, color[0], color[1], color[2]);
        /* Draw a cone for each point*/
        this.points.forEach((point) => {
            const modelViewMatrix = mat4.create();
            mat4.translate(
                modelViewMatrix,
                modelViewMatrix,
                [point.x/this.inputImage.width*2 - 1, point.y/this.inputImage.height * 2 - 1, 0]
            );
            mat4.scale(
                modelViewMatrix,
                modelViewMatrix,
                 [1/this.inputImage.width, 1/this.inputImage.height, 1.0]
            );
            
            this.gl.uniformMatrix4fv(
                this.voronoi.uniforms.modelViewMatrix,
                false,
                modelViewMatrix
            );
            this.gl.uniformMatrix4fv(
                this.voronoi.uniforms.modelViewMatrix,
                false,
                modelViewMatrix
            );
            this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, this.coneResolution+2);
        });
    }

    /* Renders a 1xcells textures containing the centroid of each cell of the Voronoi diagram
     * encoded in the colors of each pixel */
    _renderCentroid(){
        this.gl.useProgram(this.centroid.shaderProgram);

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffers.intermediate);
        this.gl.viewport(0, 0, this.samples, this.inputImage.height * this.voronoiUpscaleConstant);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.quadPositionBuffer);
        this.gl.vertexAttribPointer(this.centroid.attributes.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);

        /* Setup model view matrix for next voroni point */
        const modelViewMatrix = mat4.create();
        this.gl.uniformMatrix4fv(
            this.centroid.uniforms.modelViewMatrix,
            false,
            modelViewMatrix
        );
        this.gl.uniform2fv(
            this.centroid.uniforms.windowDimensions,
            new Float32Array([this.inputImage.width * this.voronoiUpscaleConstant, this.inputImage.height * this.voronoiUpscaleConstant])
        );
        this.gl.uniform1i(
            this.centroid.uniforms.voronoiUpscaleConstant,
            this.voronoiUpscaleConstant
        );

        /* Setup Texture Samplers */
        this.gl.uniform1i(this.centroid.uniforms.imageSampler, 0);
        this.gl.uniform1i(this.centroid.uniforms.voronoiSampler, 1);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }

    /* Renders the 1xsamples output of the centroids to a canvas */
    _renderOutput(){
        this.gl.useProgram(this.output.shaderProgram);
        
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.samples, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.outputIndiceBuffer);
        this.gl.vertexAttribPointer(this.output.attributes.outputIndex, 1, this.gl.UNSIGNED_INT, false, 0, 0);

        /* Setup model view matrix for next voroni point */
        const modelViewMatrix = mat4.create();
        this.gl.uniform1f(
            this.output.uniforms.voronoiUpscaleConstant,
            this.voronoiUpscaleConstant
        );
        this.gl.uniform2fv(
            this.output.uniforms.windowDimensions,
            new Float32Array([this.inputImage.width * this.voronoiUpscaleConstant, this.inputImage.height * this.voronoiUpscaleConstant])
        );

        this.gl.uniform1i(this.output.uniforms.intermediateSampler, 2);

        this.gl.bindBufferBase(this.gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.buffers.instancedPositionBuffer);

        this.gl.beginTransformFeedback(this.gl.POINTS);
        this.gl.drawArrays(this.gl.POINTS, 0, this.samples);
        this.gl.endTransformFeedback();

        this.gl.bindBufferBase(this.gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    }
    
    render(){
        if(!this.imageLoaded){
            return;
        }
        this._renderVoronoi(this.frameBuffers.voronoi);
        this._renderCentroid();
        this._renderOutput();
    }
    getCanvasDOMNode(){
        return this.canvas;
    }
}

window.VoroniRenderer = VoroniRenderer;

export default VoroniRenderer;