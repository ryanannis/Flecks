import VoronoiStippler from './VoronoiStippler';

const fileUploader = document.getElementById('fileUploader');
const loadForm = document.getElementById('loadForm');
const preview = document.getElementById('preview');
const submitButton = document.getElementById('submitButton');
const iterationsInput = document.getElementById('iterations');
const scaleInput = document.getElementById('scale');
const stipplesInput = document.getElementById('stipples');
const supersamplingInput = document.getElementById('supersampling');

let file = null;
let fileValid = false;
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

const handleOnIterate = (iterationsLeft) => {
    console.log(iterationsLeft);
    if(iterationsLeft=== 0){
        fileUploader.disabled = false;
    }
};

const formSubmit = (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    fileUploader.disabled = true;


    const img = document.getElementById("imgpreview");
    /* Execute voronoi */
    const numStipples = Number(stipplesInput.value);
    const numIterations = Number(iterationsInput.value);
    const scale = Number(scaleInput.value);
    const supersamplingAmount = Number(supersamplingInput.value);
    const voroni = new VoronoiStippler(numStipples, numIterations, img, scale, supersamplingAmount, handleOnIterate);
    const canvas = voroni.getCanvasDOMNode();
    img.replaceWith(canvas);
}

loadForm.onsubmit = formSubmit;
fileUploader.onchange = fileChange;

