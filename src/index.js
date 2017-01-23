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
    void main(void) { 
        gl_FragColor =  vec4(1.0, 1.0, 1.0, 1.0);
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
    constructor(width, height, debug){
        this.width = width;
        this.height = height;
        this.debug = debug;
        
        /* Init offscreen canvas */
        this.canvas = document.createElement("canvas"); 
        this.canvas.width = width;
        this.canvas.height = height;

        this.gl = this.canvas.getContext('webgl');
        this.glPointers = {attributes: {}, uniforms: {}, buffers: {}};

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
        const quadVertices = this._createQuad();
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(quadVertices), this.gl.STATIC_DRAW);
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

        /* Setup model view matrix for next voroni point */
        const modelViewMatrix = mat4.create();

        this.gl.uniformMatrix4fv(
            this.glPointers.uniforms.modelViewMatrix,
            false,
            modelViewMatrix
        );

        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
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
}

window.VoroniRenderer = VoroniRenderer;

export default VoroniRenderer;