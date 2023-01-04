const { ipcRenderer } = require('electron');

let screenStream;
let audioStream;
let recordedChunks;
let mediaRecorder;
let recording = false;
let canvas;
let ctx;
let video;
let offsetX;
let offsetY;

const startControls = document.getElementById("startcontrols");
const stopControls = document.getElementById("stopcontrols");
const counter = document.getElementById("counter");
const controls = document.getElementById("controls");
const audioInputSelect = document.getElementById("microphone");
const videoSelect = document.getElementById("camera");
const selectors = [audioInputSelect, videoSelect];

let countdown = 0;

stopControls.style.display = "none";

document.getElementById("record").addEventListener("click", () => {
    startRecording();
});

document.getElementById("stop").addEventListener("click", () => {
    stopRecording();
});

document.getElementById("quit").addEventListener("click", () => {
    ipcRenderer.send("quit");
});

console.log("Register handler for set source");

ipcRenderer.on("position", async (event, x, y) => {
    if (!recording) {
        offsetX = x;
        offsetY = y;
    }
});

ipcRenderer.on('SET_SOURCE', async (event, sourceId) => {
    try {
        if (screenStream) {
            screenStream.getTracks().forEach(track => {
                track.stop();
            });
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    // minWidth: 1280,
                    // maxWidth: 1280,
                    // minHeight: 720,
                    // maxHeight: 720
                }
            }
        })
        screenStream = stream;
    } catch (e) {
        handleError(e)
    }
})

function handleEnumError(e) {
    console.log(e);
}

function handleError(e) {
    console.log(e);
    alert("Failed to get screen stream!");
}

function handleDataAvailable(event) {
    if (event.data.size > 0) {
        recordedChunks.push(event.data);
    }
}

async function save() {
    const blob = new Blob(recordedChunks, {
        type: "video/webm"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    a.href = url;
    a.download = "recording-" + (Date.now()) + ".webm";
    a.click();
    window.URL.revokeObjectURL(url);
}

function copyFrame() {
    if (recording) {
        video.requestVideoFrameCallback(copyFrame);
    }

    ctx.drawImage(video, -offsetX, -offsetY);
}

function startRecording() {
    controls.style.display = "none";
    if (countdown === 0) {
        countdown = 5;
        showCountdownOrStart();
    }
}

function showCountdownOrStart() {
    if (countdown === 0) {
        counter.innerHTML = "";
        startRecordingStreams();
    } else {
        counter.innerHTML = "" + countdown;
        countdown--;
        setTimeout(showCountdownOrStart, 1000);
    }
}

function startRecordingStreams() {
    recording = true;
    video = document.createElement("video");
    video.srcObject = screenStream;
    video.autoplay = true;
    video.play();

    canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx = canvas.getContext("2d");
    video.requestVideoFrameCallback(copyFrame);

    const cutStream = canvas.captureStream(60);

    ipcRenderer.send("startRecording");
    stopControls.style.display = "initial";
    startControls.style.display = "none";

    setTimeout(() => {
        recordedChunks = [];
        const options = { mimeType: "video/webm; codecs=vp9" };
        const combinedStream = new MediaStream([cutStream.getVideoTracks()[0], audioStream.getAudioTracks()[0]]);
        mediaRecorder = new MediaRecorder(combinedStream, options);

        mediaRecorder.ondataavailable = handleDataAvailable;
        mediaRecorder.start();
    }, 250);
}

function stopRecording() {
    controls.style.display = "flex";
    counter.innerHTML = "";
    startControls.style.display = "initial";
    stopControls.style.display = "none";

    recording = false;
    mediaRecorder.stop();
    ipcRenderer.send("stopRecording");
    setTimeout(() => {
        save();
    }, 1000);
}

function gotDevices(deviceInfos) {
    // Handles being called several times to update labels. Preserve values.
    const values = selectors.map(select => select.value);
    selectors.forEach(select => {
        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }
    });
    for (let i = 0; i !== deviceInfos.length; ++i) {
        const deviceInfo = deviceInfos[i];
        const option = document.createElement('option');
        option.value = deviceInfo.deviceId;
        if (deviceInfo.kind === 'audioinput') {
            option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
            audioInputSelect.appendChild(option);
        } else if (deviceInfo.kind === 'videoinput') {
            option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
            videoSelect.appendChild(option);
        } else {
            console.log('Some other kind of source/device: ', deviceInfo);
        }
    }
    selectors.forEach((select, selectorIndex) => {
        if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
            select.value = values[selectorIndex];
        }
    });
}


function start() {
    const videoSource = videoSelect.value;
    ipcRenderer.send("changeVideo", videoSource);
    if (audioStream) {
        audioStream.getTracks().forEach(track => {
            track.stop();
        });
    }
    const audioSource = audioInputSelect.value;
    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ 
            audio: { deviceId: audioSource ? { exact: audioSource } : undefined },
        })
            .then(function (stream) {
                console.log("Got new audio stream");
                audioStream = stream;
            })
            .catch(function (e) {
                console.log("Something went wrong!");
                console.log(e);
                alert("Failed to get audio stream!");
            });
    }
}


navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleEnumError);

audioInputSelect.onchange = start;
videoSelect.onchange = start;

start();