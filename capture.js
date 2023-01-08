const { ipcRenderer } = require('electron');
const Buffer = require('buffer').Buffer;
let storage = {};

ipcRenderer.send("loadSettings");

let screenStream;
let audioStream;
let systemAudioStream;
let recordedChunks;
let mediaRecorder;
let recording = false;
let canvas;
let ctx;
let video;
let offsetX;
let offsetY;
let videoInUse;
let audioInUse;
let timeout;

const startControls = document.getElementById("startcontrols");
const startingControls = document.getElementById("starting");
const stopControls = document.getElementById("stopcontrols");
const counter = document.getElementById("counter");
const controls = document.getElementById("controls");
const audioInputSelect = document.getElementById("microphone");
const videoSelect = document.getElementById("camera");
const selectors = [audioInputSelect, videoSelect];

let countdown = 0;

stopControls.style.display = "none";
startingControls.style.display = "none";

document.getElementById("drag").addEventListener("dblclick", () => {
    ipcRenderer.send("fullscreen");
});

document.getElementById("cancel").addEventListener("click", () => {
    cancelRecording();
});

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

ipcRenderer.on("settings", async (event, s) => {
    storage = s;
    navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleEnumError);
});

ipcRenderer.on("doStop", async (event, x, y) => {
    this.stopRecording();
});

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

        console.log("Got screen stream: " + stream);
    } catch (e) {
        handleError(e)
    }

    try {
        systemAudioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                }
            },
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                }
            }
        });
    } catch (e) {
        // system media access won't work on OSX, just ignore
    }
})

function handleEnumError(e) {
    console.log(e);
}

function handleError(e) {
    console.log(e);
    alert("Failed to get screen stream! " + e);
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
    ipcRenderer.send("saveFile", {
        data: Buffer.from(await blob.arrayBuffer())
    });
}

function copyFrame() {
    if (recording) {
        video.requestVideoFrameCallback(copyFrame);
    }

    ctx.drawImage(video, -offsetX, -offsetY);
}

function startRecording() {
    controls.style.display = "none";
    startingControls.style.display = "initial";
    if (countdown === 0) {
        ipcRenderer.send("preRecording");

        countdown = 5;
        showCountdownOrStart();
    }
}

function showCountdownOrStart() {
    if (countdown === 0) {
        counter.innerHTML = "";
        startingControls.style.display = "none";
        startRecordingStreams();
    } else {
        counter.innerHTML = "" + countdown;
        countdown--;
        timeout = setTimeout(showCountdownOrStart, 1000);
    }
}

function startRecordingStreams() {
    recording = true;
    video = document.createElement("video");
    video.srcObject = screenStream;
    video.autoplay = true;
    video.play();

    canvas = document.createElement("canvas");
    canvas.width = Math.floor(window.innerWidth / 2) * 2;
    canvas.height =  Math.floor(window.innerHeight / 2) * 2;
    ctx = canvas.getContext("2d");
    video.requestVideoFrameCallback(copyFrame);

    const cutStream = canvas.captureStream(60);

    ipcRenderer.send("startRecording");
    stopControls.style.display = "initial";
    startControls.style.display = "none";

    setTimeout(() => {
        recordedChunks = [];
        const tracks = [];

        tracks.push(cutStream.getVideoTracks()[0]);

        const audioContext = new AudioContext();
        const audioStreamDestination = audioContext.createMediaStreamDestination();
        let hasAudio = false;

        if (audioStream) {
            hasAudio = true;
            audioContext.createMediaStreamSource(new MediaStream(audioStream.getAudioTracks())).connect(audioStreamDestination);
        }
        if (systemAudioStream) {
            hasAudio = true;
            audioContext.createMediaStreamSource(new MediaStream(systemAudioStream.getAudioTracks())).connect(audioStreamDestination);
        }

        if (hasAudio) {
            tracks.push(audioStreamDestination.stream.getAudioTracks()[0]);
        }

        const options = { mimeType: "video/webm; codecs=vp9" };

        if (hasAudio) {
            const combinedStream = new MediaStream(tracks);
            mediaRecorder = new MediaRecorder(combinedStream, options);
        } else {
            mediaRecorder = new MediaRecorder(cutStream, options);
        }
        mediaRecorder.ondataavailable = handleDataAvailable;
        mediaRecorder.start();
    }, 250);
}

function cancelRecording() {
    countdown = 0;
    if (timeout) {
        clearTimeout(timeout);
    }
    controls.style.display = "flex";
    counter.innerHTML = "";
    startControls.style.display = "initial";
    stopControls.style.display = "none";
    startingControls.style.display = "none";

    recording = false;
    mediaRecorder.stop();
    ipcRenderer.send("stopRecording");
}

function stopRecording() {
    controls.style.display = "flex";
    counter.innerHTML = "";
    startControls.style.display = "initial";
    stopControls.style.display = "none";
    startingControls.style.display = "none";

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

    let option;

    for (let i = 0; i !== deviceInfos.length; ++i) {
        const deviceInfo = deviceInfos[i];
        option = document.createElement('option');
        option.value = deviceInfo.deviceId;
        if (deviceInfo.kind === 'audioinput') {
            option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
            audioInputSelect.appendChild(option);

            if (option.text === storage.audio) {
                option.selected = true;
            }
        } else if (deviceInfo.kind === 'videoinput') {
            option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
            videoSelect.appendChild(option);

            if (option.text === storage.video) {
                option.selected = true;
            }
        } else {
            console.log('Some other kind of source/device: ', deviceInfo);
        }
    }
    selectors.forEach((select, selectorIndex) => {
        if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
            select.value = values[selectorIndex];
        }
    });

    option = document.createElement('option');
    option.label = "No Camera";
    option.value = "none";
    option.innerHTML = "No Camera";
    if (option.text === storage.video) {
        option.selected = true;
    }
    videoSelect.appendChild(option);
    option = document.createElement('option');
    option.label = "No Microphone";
    option.value = "none";
    option.innerHTML = "No Microphone";
    if (option.text === storage.audio) {
        option.selected = true;
    }
    audioInputSelect.appendChild(option);

    start();
}

function start() {
    storage.audio = audioInputSelect.options[audioInputSelect.selectedIndex].innerHTML;
    storage.video = videoSelect.options[videoSelect.selectedIndex].innerHTML;
    ipcRenderer.send("saveSettings", storage);

    const videoSource = videoSelect.value;
    if (videoSource !== videoInUse) {
        videoInUse = videoSource;
        ipcRenderer.send("changeVideo", videoSource);
        if (audioStream) {
            audioStream.getTracks().forEach(track => {
                track.stop();
            });
        }
    }
    const audioSource = audioInputSelect.value;
    if (audioSource !== audioInUse) {
        audioInUse = audioSource;
        if (audioSource === "none") {
            audioStream = undefined;
        } else {
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
    }
}

audioInputSelect.onchange = start;
videoSelect.onchange = start;