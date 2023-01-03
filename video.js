const { ipcRenderer } = require('electron');

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let sourceId = undefined;
let videoStream = undefined;

ctx.fillStyle = "black";
ctx.fillRect(0, 0, canvas.width, canvas.height);

var video = document.querySelector("#videoElement");
video.requestVideoFrameCallback(drawFrame);

ipcRenderer.on("device", async (event, id) => {
    sourceId = id;
    captureVideo();
});

function captureVideo() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => {
            track.stop();
        });
    }
    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ 
            video: { deviceId: sourceId ? { exact: sourceId } : undefined },
        })
            .then(function (stream) {
                videoStream = stream;
                video.srcObject = stream;
            })
            .catch(function (e) {
                console.log("Something went wrong!");
            });
    }
}

function drawFrame() {
    video.requestVideoFrameCallback(drawFrame);

    if (video.videoWidth === 0) {
        return;
    }

    const scale = canvas.height / video.videoHeight;
    const width = video.videoWidth * scale;

    ctx.drawImage(video, (canvas.width - width) / 2, 0, width, canvas.height);
}

captureVideo();