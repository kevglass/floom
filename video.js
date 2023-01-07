const { ipcRenderer } = require('electron');
const path = require('path');

const canvas = document.getElementById("canvas");
const avatar = document.getElementById("avatar");
const ctx = canvas.getContext("2d");

let faceMesh;
let sourceId = undefined;
let videoStream = undefined;
let sizeIndex = 0;
let sizes = [150, 200, 250, 300];
let effectIndex = 0;
let effects = ["none", "sepia", "grayscale", "invert"];
let selectedEffect = "none";
let mouthRange = {
    min: 0.1,
    max: 0.3
};
let leftEyeRange = {
    min: 0.3,
    max: 0.05
};
let rightEyeRange = {
    min: 0.3,
    max: 0.05
}
let rightBrowRange = {
    min: undefined,
    max: undefined
}
let leftBrowRange = {
    min: undefined,
    max: undefined
}
let mouthBig;
let teeth;
let tongue;
let eyes;
let leftEye;
let rightEye;
let faceMeshReady = false;
let brows;
let appPath;

ctx.fillStyle = "black";
ctx.fillRect(0, 0, canvas.width, canvas.height);
avatar.style.display = "none";

var video = document.querySelector("#videoElement");
video.requestVideoFrameCallback(drawFrame);

ipcRenderer.on("avatar", async (event, content) => {
    document.getElementById("svg").innerHTML = content;
    processAvatar();
});

ipcRenderer.on("path", async(event, path) => {
    appPath = path;
});

ipcRenderer.on("device", async (event, id) => {
    sourceId = id;
    captureVideo();
});

ipcRenderer.on("startRecording", async(event, id) => {
    document.getElementById("controls").style.display = "none";
});

ipcRenderer.on("stopRecording", async(event, id) => {
    document.getElementById("controls").style.display = "flex";
});

document.getElementById("effect").addEventListener("click", () => {
    effectIndex = ((effectIndex + 1) % effects.length);
    selectedEffect = effects[effectIndex];
});

document.getElementById("scale").addEventListener("click", () => {
    sizeIndex = ((sizeIndex + 1) % sizes.length);
    const size = sizes[sizeIndex];
    window.resizeTo(size, size);
    canvas.width = size;
    canvas.height = size;
});

document.getElementById("avatarButton").addEventListener("click", () => {
    if (avatar.style.display === "none") {
        avatar.style.display = "initial";
        canvas.style.display = "none";
    } else {
        canvas.style.display = "initial";
        avatar.style.display = "none";
    }
});

document.getElementById("loadAvatar").addEventListener("click", () => {
    changeAvatar();
});

function processAvatar() {
    mouthBig = document.getElementById('Mouth/Smile');
    teeth = document.getElementById('Teeth');
    tongue = document.getElementById('Tongue');
    teeth.parentElement.removeChild(teeth);
    tongue.parentElement.removeChild(tongue);

    eyes = document.getElementById("Eyes/Default-😀");
    leftEye = eyes.getElementsByTagName("circle").item(0);
    rightEye = eyes.getElementsByTagName("circle").item(1);

    brows = document.getElementById("I-Browse");
}

function changeAvatar() {
    let input = document.createElement('input');
    input.type = 'file';

    input.onchange = e => {
        let file = e.target.files[0];

        // setting up the reader
        let reader = new FileReader();
        reader.readAsText(file, 'UTF-8');

        // here we tell the reader what to do when it's done reading...
        reader.onload = readerEvent => {
            var content = readerEvent.target.result; // this is the content!
            document.getElementById("svg").innerHTML = content;
            ipcRenderer.send("saveAvatar", content);
            processAvatar();

            avatar.style.display = "initial";
            canvas.style.display = "none";
        }
    }

    input.click();
}

function createFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: (file) => {
            if (file === "face_mesh_solution_packed_assets.data") {
                return `${appPath}${path.sep}facemesh${path.sep}${file}`;
            } else {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        }
    });
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    faceMesh.onResults(onResults);

    faceMeshReady = true;
}

function captureVideo() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => {
            track.stop();
        });
    }
    if (sourceId !== "none") {
        if (navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ 
                video: { deviceId: sourceId ? { exact: sourceId } : undefined },
            })
                .then(function (stream) {
                    videoStream = stream;
                    video.srcObject = stream;

                    if (!faceMesh) {
                        createFaceMesh();
                    }
                })
                .catch(function (e) {
                    console.log(e);
                    console.log("Something went wrong!");
                });
        }
    } else {
        videoStream = undefined;
    }
}

function findMinMaxAverage(landmarks, indicies) {
    const result = {
        averageX: 0,
        averageY: 0,
        minY: undefined,
        maxY: undefined
    };
    for (const ptIndex of indicies) {
        const pt = landmarks[ptIndex[0]];
        result.averageX += pt.x;
        result.averageY += pt.y;
        if ((result.minY === undefined) || (result.minY > pt.y)) {
            result.minY = pt.y;
        }
        if ((result.maxY === undefined) || (result.maxY < pt.y)) {
            result.maxY = pt.y;
        }
    }
    result.averageX /= indicies.length;
    result.averageY /= indicies.length;

    return result;
}

let done = false;

function onResults(results) {
    let leftEyeStats;
    let rightEyeStats;
    let faceStats;
    let mouthStats;
    let leftBrowStats;
    let rightBrowStats;

    if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {
            leftEyeStats = findMinMaxAverage(landmarks, FACEMESH_LEFT_EYE);
            rightEyeStats = findMinMaxAverage(landmarks, FACEMESH_RIGHT_EYE);
            faceStats = findMinMaxAverage(landmarks, FACEMESH_FACE_OVAL);
            mouthStats = findMinMaxAverage(landmarks, FACEMESH_LIPS);
            rightBrowStats = findMinMaxAverage(landmarks, FACEMESH_RIGHT_EYEBROW);
            leftBrowStats = findMinMaxAverage(landmarks, FACEMESH_LEFT_EYEBROW);

            const faceHeight = faceStats.maxY - faceStats.minY;
            const mouthHeight = (mouthStats.maxY - mouthStats.minY) / faceHeight;
            const leftEyeHeight = (leftEyeStats.maxY - leftEyeStats.minY) / faceHeight;
            const rightEyeHeight = (rightEyeStats.maxY - rightEyeStats.minY) / faceHeight;

            if ((mouthRange.min === undefined) || (mouthRange.min > mouthHeight)) {
                mouthRange.min = mouthHeight;
            }
            if ((mouthRange.max === undefined) || (mouthRange.max < mouthHeight)) {
                mouthRange.max = mouthHeight;
            }

            if ((leftEyeRange.min === undefined) || (leftEyeRange.min > leftEyeHeight)) {
                leftEyeRange.min = leftEyeHeight;
            }
            if ((leftEyeRange.max === undefined) || (leftEyeRange.max < leftEyeHeight)) {
                leftEyeRange.max = leftEyeHeight;
            }
            if ((rightEyeRange.min === undefined) || (rightEyeRange.min > rightEyeHeight)) {
                rightEyeRange.min = rightEyeHeight;
            }
            if ((rightEyeRange.max === undefined) || (rightEyeRange.max < rightEyeHeight)) {
                rightEyeRange.max = rightEyeHeight;
            }

            if ((leftBrowRange.min === undefined) || (leftBrowRange.min > leftBrowStats.averageY)) {
                leftBrowRange.min = leftBrowStats.averageY;
            }
            if ((leftBrowRange.max === undefined) || (leftBrowRange.max < leftBrowStats.averageY)) {
                leftBrowRange.max = leftBrowStats.averageY;
            }
            if ((rightBrowRange.min === undefined) || (rightBrowRange.min > rightBrowStats.averageY)) {
                rightBrowRange.min =  rightBrowStats.averageY;
            }
            if ((rightBrowRange.max === undefined) || (rightBrowRange.max < rightBrowStats.averageY)) {
                rightBrowRange.max = rightBrowStats.averageY;
            }

            let mouthOpenPer = (mouthHeight - mouthRange.min) / (mouthRange.max - mouthRange.min);
            if (mouthOpenPer < 0.15) {
                mouthOpenPer = 0.15;
            }
            let leftEyePer = (leftEyeHeight - leftEyeRange.min) / (leftEyeRange.max - leftEyeRange.min);
            if (leftEyePer < 0.1) {
                leftEyePer = 0.1;
            }
            if (leftEyePer > 0.15) {
                leftEyePer = 1;
            }
            let rightEyePer = (rightEyeHeight - rightEyeRange.min) / (rightEyeRange.max - rightEyeRange.min);
            if (rightEyePer < 0.15) {
                rightEyePer = 0.15;
            }
            if (rightEyePer > 0.15) {
                rightEyePer = 1;
            }
            let leftBrowPosition = ((leftBrowStats.averageY - leftBrowRange.min) / (leftBrowRange.max - leftBrowRange.min));
            let rightBrowPosition = ((rightBrowStats.averageY - rightBrowRange.min) / (rightBrowRange.max - rightBrowRange.min));
            
            let browPosition = rightBrowPosition;
            if (Math.abs(leftBrowPosition) < Math.abs(rightBrowPosition)) {
                browPosition = leftBrowPosition;
            }

            const eyeScale = Math.max(0.3, Math.max(rightEyePer, leftEyePer));
            TweenMax.to(mouthBig, 0.05, { scaleY: Math.min(1.5, 0.2 + (mouthOpenPer * 2)) });
            TweenMax.to(leftEye, 0.05, { scaleY: eyeScale });
            TweenMax.to(rightEye, 0.05, { scaleY: eyeScale });
            if (!Number.isNaN(browPosition)) {
                TweenMax.to(brows, 0.05, { y: (browPosition * 10)  });
            }

            // only process first face
            break;
        }
    }
}

function drawFrame() {
    video.requestVideoFrameCallback(drawFrame);

    if (video.videoWidth === 0) {
        return;
    }

    if (avatar.style.display === "none") {
        const scale = canvas.height / video.videoHeight;
        const width = video.videoWidth * scale;

        ctx.save();
        if (selectedEffect === "none") {
            ctx.filter = "";
        }
        if (selectedEffect === "sepia") {
            ctx.filter = "sepia(1)";
        }
        if (selectedEffect === "grayscale") {
            ctx.filter = "grayscale(1)";
        }
        if (selectedEffect === "invert") {
            ctx.filter = "invert(1)";
        }
        ctx.drawImage(video, (canvas.width - width) / 2, 0, width, canvas.height);
        ctx.restore();
    } else {
        if (faceMeshReady) {
            try {
                faceMeshReady = false;
                faceMesh.send({ image: video }).then(() => {
                    faceMeshReady = true;
                }).catch((e) => {
                    console.log(e);
                    createFaceMesh();
                });
            } catch (e) {
                console.log(e);
            }
        }
    }
}

processAvatar();
const index = sizes.findIndex(value => value === window.innerHeight);
if (index >= 0) {
    sizeIndex = index;
}