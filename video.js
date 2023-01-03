const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
ctx.fillStyle = "black";
ctx.fillRect(0, 0, canvas.width, canvas.height);

var video = document.querySelector("#videoElement");
video.requestVideoFrameCallback(drawFrame);

function drawFrame() {
    video.requestVideoFrameCallback(drawFrame);

    if (video.videoWidth === 0) {
        return;
    }

    const scale = canvas.height / video.videoHeight;
    const width = video.videoWidth * scale;

    ctx.drawImage(video, (canvas.width - width) / 2, 0, width, canvas.height);
}

if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function (stream) {
            video.srcObject = stream;
        })
        .catch(function (err0r) {
            console.log("Something went wrong!");
        });
}