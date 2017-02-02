import VoronoiStippler from './VoronoiStippler';

const fileUploader = document.getElementById('fileUploader');
const loadForm = document.getElementById('loadForm');
const preview = document.getElementById('preview');
const submitButton = document.getElementById('submitButton');
const iterationsInput = document.getElementById('iterations');
const scaleInput = document.getElementById('scale');
const stipplesInput = document.getElementById('stipples');
const supersamplingInput = document.getElementById('supersampling');
const progressContainer = document.getElementById('progress');
const progressBar = document.getElementById('progressbar');

let file = null;
let fileValid = false;
let activeCanvas = null;
let lastImageDomNode = null;

const showProgressBar = () => {
    
}

const getCanvasValid = () => {
    /* Test for Proper WebGL Suppport*/
    const testCanvas = document.createElement("canvas");
    const testCtx = testCanvas.getContext("webgl2");
    if(!testCtx){
        return false;
    }
    const float_texture_ext = this.gl.getExtension('EXT_color_buffer_float');
    if(!float_texture_ext){
        return false;
    }
    return true;
}



const fileChange = () => {
    const file = fileUploader.files[0];
    const prevImage = document.getElementById("imgpreview");
    const canvas = document.getElementById("renderCanvas");

    const img = document.createElement("img");
    img.classList.add("obj");
    img.file = file;
    img.id= "imgpreview";
    
    if(prevImage){
       prevImage.replaceWith(img);
    }
    else if(canvas){
        canvas.replaceWith(img);
    }
    else{
         preview.appendChild(img);
    }
    const reader = new FileReader();
    reader.onload = (
        function(aImg){
            return function(e) {
                aImg.src = e.target.result;
            }; 
    })(img);
    reader.readAsDataURL(file);

    fileValid = true;
    if(fileValid){
        submitButton.disabled = false;
        fileUploader.disabled = false;
    }
}

const handleOnIterate = (numIterations) => (iterationsLeft) => {
    if(iterationsLeft === 0){
        fileUploader.disabled = false;
        submitButton.disabled = false;
        progressContainer.style.display = 'none';
        console.log('ding');
    }
    else{
        console.log((numIterations-iterationsLeft)/numIterations);
        progressBar['aria-valuenow'] = Math.ceil((numIterations-iterationsLeft)/numIterations) * 100;
        progressBar.style.width = Math.ceil((numIterations-iterationsLeft)/numIterations) * 100 + '%';
    }
};

const formSubmit = (event) => {
    event.preventDefault();
    fileUploader.disabled = true;
    submitButton.disabled = true;
    
    if(document.getElementById("imgpreview")){
        lastImageDomNode = document.getElementById("imgpreview");
    }
    
    /* Execute voronoi */
    const numStipples = Number(stipplesInput.value);
    const numIterations = Number(iterationsInput.value);
    const scale = Number(scaleInput.value);
    const supersamplingAmount = Number(supersamplingInput.value);
    const voroni = new VoronoiStippler(
        numStipples,
        numIterations,
        lastImageDomNode,
        scale,
        supersamplingAmount,
        handleOnIterate(numIterations)
    );
    const canvas = voroni.getCanvasDOMNode();
    if(activeCanvas){
        activeCanvas.replaceWith(canvas);
    }
    else{
        lastImageDomNode.replaceWith(canvas);
    }
    activeCanvas = canvas;
}

loadForm.onsubmit = formSubmit;
fileUploader.onchange = fileChange;

