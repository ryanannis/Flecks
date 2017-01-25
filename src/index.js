import { mat4 } from 'gl-matrix';

/* Credits to Matt Keeter for this approach https://www.mattkeeter.com/projects/swingline/ */
const centroidVertexShader = `
    attribute vec3 vertexPosition;

    uniform mat4 orthoMatrix;
    uniform mat4 modelViewMatrix;

    void main(void) {
        gl_Position = orthoMatrix * modelViewMatrix * vec4(vertexPosition, 1.0);
    }
`;

const centroidFragmentShader = `
    precision highp float; //fuck gl es 2.0 and no texelfetch
    
    uniform sampler2D imageSampler;
    uniform sampler2D voronoiSampler;
    uniform vec2 windowDimensions;

    const float max_samples = 10000.0;

      void main(void) { 
        // Index of Voronoi cell being searched for
        int myIndex = int(gl_FragCoord.x);
        vec4 color = vec4(0.0, 0.0, 0.0, 0.0);

        for(float x = 0.0; x < max_samples ; x++){
            if(x > windowDimensions.x){
                break;
            }
            vec2 coord = vec2(x / windowDimensions.x, gl_FragCoord.y / windowDimensions.y);
            vec4 voronoiTexel = texture2D(voronoiSampler, coord);

            int i = int(255.0 * voronoiTexel.x + 65025.0 * voronoiTexel.y + 16581375.0 * voronoiTexel.z);

            if(myIndex == i){
                vec4 imageTexel = texture2D(imageSampler, coord);

                // Using Photometric/digital ITU BT.709 standard for luminesence
                float weight = 1.0 - 0.99 * (0.2126 * imageTexel.x + 0.7152 * imageTexel.y + 0.0722 * imageTexel.z);
                
                vec2 integerCoord = vec2(x, gl_FragCoord.y);

                color.xy += (integerCoord + 0.5) * weight;
                color.w += weight;
                color.z += 1.0;
            }
        }

        color.x = color.x / windowDimensions.x;
        color.y = color.y / windowDimensions.y;
        
        gl_FragColor = vec4(color.x, color.y, color.z, 1.0);
    }
`;

const voronoiVertexShader  = `
    attribute vec3 vertexPosition;
    uniform mat4 orthoMatrix;
    uniform mat4 modelViewMatrix;
    void main(void) {
        gl_Position = orthoMatrix * modelViewMatrix * vec4(vertexPosition, 1.0);
    }
`;

const voronoiFragmentShader = `
    precision mediump float;
    uniform vec3 vertexColor;
    void main(void) { 
        gl_FragColor =  vec4(vertexColor, 1.0);
    }
`;

/**
 * Utility for generating offscreen Voroni Diagrams
 */
class VoroniRenderer{
    /**
     * @param {Number} width
     * @param {Number} height
     */
    constructor(debug){
        this.imageLoaded = false;
        this.debug = debug;
        this._init();
    }

    _init(){
        this.coneResolution = 100;
        /* Init offscreen canvas */
        this.canvas = document.createElement("canvas"); 
        this.canvas.width = 0;
        this.canvas.height = 0;

        this.gl = this.canvas.getContext('webgl');
        this.textures = {};
        this.buffers = {};
        this.centroid = {attributes: {}, uniforms: {}};
        this.voronoi = {attributes: {}, uniforms: {}};
        this.frameBuffers = {};
        this._loadImage(() => this._initGL());
    }
    _initGL(){
        this.canvas.width = this.inputImage.width;
        this.canvas.height = this.inputImage.height;
        this._initShaders();

        /* Create Uniforms/Attributes*/
        this._getUniformLocations();
        this._getAttributeLocations();
        this._getBuffers();

        /* Bind data*/
        this._bindDataToBuffers();
        this._bindDataToUniforms();

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
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.inputImage.width, this.inputImage.height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
        
        this.frameBuffers.voronoi = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffers.voronoi);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.textures.voronoiTexture, 0);

        /* Voronoi diagram needs a depthbuffer because of how the cone algorithm works */
        const renderbuffer = this.gl.createRenderbuffer();
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, renderbuffer);
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, this.inputImage.width, this.inputImage.height);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.textures.voronoiTexture, 0);
        this.gl.framebufferRenderbuffer(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.RENDERBUFFER, renderbuffer);
    }

    _initImageAsTexture(){
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.textures.imageTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.imageTexture);
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
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
        vertices[0] = x;
        vertices[1] = y;
        vertices[2] = -3;
        for(let i = 1 ; i <= edges+2; i++){
            const ratio = i/edges;
            vertices[i*3] = 3 * (x + Math.sin(2 * pi * ratio));
            vertices[i*3+1] = 3 * (y + Math.cos(2 * pi * ratio));
            vertices[i*3+2] = -5;
        }
        return vertices;
    }

    /**
     * Inserts attribute locations into this.centroid.attributes
     */
    _getAttributeLocations(){
        this.centroid.attributes.vertexPosition = this.gl.getAttribLocation(this.centroid.shaderProgram, "vertexPosition");
        this.gl.enableVertexAttribArray(this.centroid.attributes.vertexPosition);
    }

    /**
     * Inserts uniform locations into this.centroid.attributes
     */
    _getUniformLocations(){
         this.centroid.uniforms.orthoMatrix = this.gl.getUniformLocation(this.centroid.shaderProgram, "orthoMatrix");
         this.centroid.uniforms.modelViewMatrix = this.gl.getUniformLocation(this.centroid.shaderProgram, "modelViewMatrix");
         this.centroid.uniforms.imageSampler = this.gl.getUniformLocation(this.centroid.shaderProgram, "imageSampler");
         this.centroid.uniforms.voronoiSampler = this.gl.getUniformLocation(this.centroid.shaderProgram, "voronoiSampler");
         this.centroid.uniforms.windowDimensions = this.gl.getUniformLocation(this.centroid.shaderProgram, "windowDimensions");

         this.voronoi.uniforms.orthoMatrix = this.gl.getUniformLocation(this.voronoi.shaderProgram, "orthoMatrix");
         this.voronoi.uniforms.modelViewMatrix = this.gl.getUniformLocation(this.voronoi.shaderProgram, "modelViewMatrix");
         this.voronoi.uniforms.vertexColor = this.gl.getUniformLocation(this.voronoi.shaderProgram, "vertexColor");
    }

    /**
     * Gets buffers and inserts them into this.buffers
     */
    _getBuffers(){
        this.buffers.quadPositionBuffer = this.gl.createBuffer();
        this.buffers.conePositionBuffer = this.gl.createBuffer();
    }

    /**
     * Generates geometry and color data then binds it to the appropriate buffers
     */
    _bindDataToBuffers(){
        /* Bind Quad Data*/
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.quadPositionBuffer);
        const quadVertices = this._createQuad();
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(quadVertices), this.gl.STATIC_DRAW);

        /* Bind Cone Data*/
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.conePositionBuffer);
        const coneVertices = this._createCone(0, 0, this.coneResolution);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(coneVertices), this.gl.STATIC_DRAW);
    }

    /**
     * Inserts needed matrices into uniforms
     */
    _bindDataToUniforms(){
        this.gl.useProgram(this.centroid.shaderProgram);
        const centroidOrthoMatrix = mat4.create();
        mat4.ortho(centroidOrthoMatrix, -1, 1, -1, 1, 0.001, 100);  
        this.gl.uniformMatrix4fv(
            this.centroid.uniforms.orthoMatrix,
            false,
            centroidOrthoMatrix
        );

        this.gl.useProgram(this.voronoi.shaderProgram);
        const voronoiOrthoMatrix = mat4.create();
        mat4.ortho(voronoiOrthoMatrix, -1, 1, -1, 1, 0.001, 100);  
        this.gl.uniformMatrix4fv(
            this.voronoi.uniforms.orthoMatrix,
            false,
            voronoiOrthoMatrix
        );
        
    }
    tick(){
        if(this.debug){
            requestAnimationFrame(() => this.tick());
            this.render();
        }
    }

    /* Generates test data for voronoi */
    testData(){
        this.points = [];
        for(let i = 0; i < 300; i++){
            this.points.push({x: Math.random() * 300, y: Math.random() * 300})
        }
    }

    /**
     * Encodes an int as a float in range [0-16581374].
     * @param {Number} i Must be a whole number
     * @return {Float32Array} A 3 dimensional array representing i
    */
    _encodeIntToRGB(i){
        const r = 1.0/255 * i;
        const b = 1.0/65025 * Math.floor(i/255);
        const g = 1.0/16581375 * Math.floor(i/65025);
        return new Float32Array([r, g, b]);
    }
    /**
     * Encodes the current points as a Voronoi diagram into the framebuffer.
    */
    _renderVoronoi(){
        this.gl.useProgram(this.voronoi.shaderProgram);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        /* Render Voronoi to framebuffer */
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffers.voronoi);
        this.gl.viewport(0, 0, this.inputImage.width, this.inputImage.height);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.conePositionBuffer);
        this.gl.vertexAttribPointer(this.voronoi.attributes.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);

        /* Draw a cone for each point*/
        this.points.forEach((point, idx) => {
            /* Setup model view matrix for next voroni point */
            const modelViewMatrix = mat4.create();
            mat4.translate(
                modelViewMatrix,
                modelViewMatrix,
                [point.x/this.inputImage.width*2-1, -(point.y/this.inputImage.height*2-1), 0.0]
            );
            this.gl.uniformMatrix4fv(
                this.voronoi.uniforms.modelViewMatrix,
                false,
                modelViewMatrix
            );
            const indexEncodedAsRGB = this._encodeIntToRGB(idx);
            this.gl.uniform3fv(this.voronoi.uniforms.vertexColor, indexEncodedAsRGB);
            this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, this.coneResolution+2);
        });
    }

    /* Renders a 1xcells textures containing the centroid of each cell of the Voronoi diagram
     * encoded in the colors of each pixel */
    _renderCentroid(){
        this.gl.useProgram(this.centroid.shaderProgram);

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.points.length, this.inputImage.height);
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
            new Float32Array([this.inputImage.width, this.inputImage.height])
        );

        /* Setup Texture Samplers */
        this.gl.uniform1i(this.centroid.uniforms.imageSampler, 1);
        this.gl.uniform1i(this.centroid.uniforms.voronoiSampler, 0);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
    
    render(){
        if(!this.imageLoaded){
            return;
        }
 
        this._renderVoronoi();
        this._renderCentroid();
    }
    getCanvasDOMNode(){
        return this.canvas;
    }
}

window.VoroniRenderer = VoroniRenderer;

export default VoroniRenderer;