import { mat4 } from 'gl-matrix';

const voroniVertexShader = `
    attribute vec3 vertexPosition;

    uniform mat4 orthoMatrix;
    uniform mat4 modelViewMatrix;

    void main(void) {
        gl_Position = orthoMatrix * modelViewMatrix * vec4(vertexPosition, 1.0);
    }
`;

const voroniFragmentShader = `
    precision mediump float;
    uniform vec4 vertexColor;
    void main(void) { 
        gl_FragColor =  vertexColor;
    }
`;

/**
 * Utility for generating offscreen Voroni Diagrams
 */
class VoroniRenderer{
    /**
     * @param {Number} width
     * @param {Number} height
     * @param {Number} coneResolution
     */
    constructor(width, height, coneResolution = 100, debug){
        this.width = width;
        this.height = height;
        this.coneResolution = coneResolution;
        this.debug = debug;
        
        /* Init offscreen canvas */
        this.canvas = document.createElement("canvas"); 
        this.canvas.width = width;
        this.canvas.height = height;

        this.gl = this.canvas.getContext('webgl');
        this.glPointers = {attributes: {}, uniforms: {}, buffers: {}};
        this.points = [];
        this._initGL();
    }
    _initGL(){
        this._initShaders();

        /* Create Uniforms/Attributes*/
        this._getUniformLocations();
        this._getAttributeLocations();
        this._getBuffers();

        /* Bind data*/
        this._bindDataToUniforms();
        this._bindDataToBuffers();


        /* GL state toggles*/
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
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
        /* Create shaders and shader program */
        const vertexShader = this._getShader(voroniVertexShader, this.gl.VERTEX_SHADER);
        const fragmentShader = this._getShader(voroniFragmentShader, this.gl.FRAGMENT_SHADER);

        this.glPointers.shaderProgram = this.gl.createProgram();
        
        this.gl.attachShader(this.glPointers.shaderProgram, vertexShader);
        this.gl.attachShader(this.glPointers.shaderProgram, fragmentShader);
        this.gl.linkProgram(this.glPointers.shaderProgram);

        if(!this.gl.getProgramParameter(this.glPointers.shaderProgram, this.gl.LINK_STATUS)){
          console.error("Could not initialize shaders.");
          return null;
        }

        this.gl.useProgram(this.glPointers.shaderProgram);
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
     * Inserts attribute locations into this.glPointers.attributes
     */
    _getAttributeLocations(){
        this.glPointers.attributes.vertexPosition = this.gl.getAttribLocation(this.glPointers.shaderProgram, "vertexPosition");
        this.gl.enableVertexAttribArray(this.glPointers.attributes.vertexPosition);
    }

    /**
     * Inserts uniform locations into this.glPointers.attributes
     */
    _getUniformLocations(){
         this.glPointers.uniforms.orthoMatrix = this.gl.getUniformLocation(this.glPointers.shaderProgram, "orthoMatrix");
         this.glPointers.uniforms.modelViewMatrix = this.gl.getUniformLocation(this.glPointers.shaderProgram, "modelViewMatrix");
         this.glPointers.uniforms.vertexColor = this.gl.getUniformLocation(this.glPointers.shaderProgram, "vertexColor");
    }

    /**
     * Gets buffers and inserts them into this.glPointers.buffers
     */
    _getBuffers(){
        this.glPointers.buffers.vertexPositionBuffer = this.gl.createBuffer();
    }

    /**
     * Generates geometry and color data then binds it to the appropriate buffers
     */
    _bindDataToBuffers(){

        /* Bind Vertex Data*/
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.glPointers.buffers.vertexPositionBuffer);
        const coneVertices = this._createCone(0, 0, this.coneResolution);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(coneVertices), this.gl.STATIC_DRAW);
    }

    /**
     * Inserts needed matrices into uniforms
     */
    _bindDataToUniforms(){
        const orthoMatrix = mat4.create();
        mat4.ortho(orthoMatrix, -1, 1, -1, 1, 0.001, 100);  
        this.gl.uniformMatrix4fv(
            this.glPointers.uniforms.orthoMatrix,
            false,
            orthoMatrix
        );
        
    }
    tick(){
        if(this.debug){
            requestAnimationFrame(() => this.tick());
            //this.coneResolution++;
            this.render();
        }
    }
    render(){
        if(this.debug){
            this._bindDataToBuffers();
        }

        this.gl.viewport(0, 0, this.width, this.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.glPointers.buffers.vertexPositionBuffer);
        this.gl.vertexAttribPointer(this.glPointers.attributes.vertexPosition, 3, this.gl.FLOAT, false, 0, 0);


        /* Draw a cone for each point*/
        this.points.forEach((point) => {
            /* Setup model view matrix for next voroni point */
            const modelViewMatrix = mat4.create();
            mat4.translate(
                modelViewMatrix,
                modelViewMatrix,
                [point.x/this.width*2-1, -(point.y/this.height*2-1), 0.0]
            );
            this.gl.uniformMatrix4fv(
                this.glPointers.uniforms.modelViewMatrix,
                false,
                modelViewMatrix
            );

            console.log(point);

            this.gl.uniform4f(this.glPointers.uniforms.vertexColor, point.r, point.g, point.b, 1.0);
            this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, this.coneResolution+2);
        });
    }
    /**
     * Renders with instancing enabled, which should speed rendering up greatly especially for high 
     * cone resolution.  However, support is limited so it is kept as an option.
     */
    renderInstanced(){
        //todo
    }
    getCanvasDOMNode(){
        return this.canvas;
    }
    
    setResolution(width, height){
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
    }
    addPoint(x, y, r, b, g){
        this.points.push({x, y, r: r || Math.random(), g: g || Math.random(), b: b || Math.random()});
    }
    clearPoints(){
        this.points = [];
    }
}

window.VoroniRenderer = VoroniRenderer;

export default VoroniRenderer;