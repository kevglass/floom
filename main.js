const { app, BrowserWindow, ipcMain, screen, systemPreferences, globalShortcut } = require("electron")
const { desktopCapturer } = require("electron")
const os = require("os");
const fs = require('fs');
const path = require('path')
var ffmpeg = require('ffmpeg-static-electron');
const { execFile } = require("child_process");
const { dialog } = require('electron')

let videoWindow;
let videoWindow2;
let videoWindow3;
let captureWindow;
let indicatorWindow;
let oldWidth;
let oldHeight;
let oldX;
let oldY;
let currentDisplay;
let prefullScreenBounds;
let recording = false;

ipcMain.on("loadSettings", function () {
	let storage = {};
	const storageFile = app.getPath('appData') + path.sep + "settings.json";
	console.log("Loading from: " + storageFile);
	if (fs.existsSync(storageFile)) {
		try {
			storage = JSON.parse(fs.readFileSync(storageFile).toString());
		} catch (e) {
			// do nothing, corrupt settings start anyway
			console.log(e);
		}
	}
	captureWindow.webContents.send("settings", storage);
});

ipcMain.on("saveAvatar", function(event, content) {
	const storageFile = app.getPath('appData') + path.sep + "avatar.svg";
	fs.writeFileSync(storageFile, content);
});

function saveConfiguration() {
	const config = {
		video: videoWindow.getBounds(),
		video2: videoWindow2.getBounds(),
		video3: videoWindow3.getBounds(),
		capture: captureWindow.getBounds()
	};
	const storageFile = app.getPath('appData') + path.sep + "config.json";
	fs.writeFileSync(storageFile, JSON.stringify(config));
}

function loadConfiguration() {
	const storageFile = app.getPath('appData') + path.sep + "config.json";
	if (fs.existsSync(storageFile)) {
		try {
			const config = JSON.parse(fs.readFileSync(storageFile).toString());
			videoWindow.setBounds(config.video);
			videoWindow2.setBounds(config.video2);
			videoWindow3.setBounds(config.video3);
			captureWindow.setBounds(config.capture);
		} catch (e) {
			// do nothing, corrupt settings start anyway
			console.log(e);
		}
	}
}

function createWindow() {
	videoWindow = new BrowserWindow({
		title: "Floom Video",
		width: 200,
		height: 200,
		show: false,
		transparent: true,
		frame: false,
		skipTaskbar: true,
		hasShadow: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		}
	});
	videoWindow.setAlwaysOnTop(true, "pop-up-menu");
	videoWindow.loadFile("video.html");

	videoWindow2 = new BrowserWindow({
		title: "Floom Video",
		width: 200,
		height: 200,
		show: false,
		transparent: true,
		frame: false,
		skipTaskbar: true,
		hasShadow: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		}
	});
	videoWindow2.setAlwaysOnTop(true, "pop-up-menu");
	videoWindow2.loadFile("video.html");

	videoWindow3 = new BrowserWindow({
		title: "Floom Video",
		width: 200,
		height: 200,
		show: false,
		transparent: true,
		frame: false,
		skipTaskbar: true,
		hasShadow: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		}
	});
	videoWindow3.setAlwaysOnTop(true, "pop-up-menu");
	videoWindow3.loadFile("video.html");

	indicatorWindow = new BrowserWindow({
		title: "",
		skipTaskbar: true,
		show: false,
		width: 800,
		height: 600,
		transparent: true,
		roundedCorners: false,
		frame: false,
		hasShadow: false,
		webPreferences: { 
			nodeIntegration: true,
			contextIsolation: true,
		}
	});
	indicatorWindow.setAlwaysOnTop(true, "status");
	indicatorWindow.loadFile("indicator.html");
	indicatorWindow.setIgnoreMouseEvents(true);

	captureWindow = new BrowserWindow({
		title: "Floom Capture",
		width: 800,
		height: 600,
		transparent: true,
		frame: false,
		roundedCorners: false,
		hasShadow: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		}
	});

	captureWindow.setAlwaysOnTop(true, "status");
	captureWindow.loadFile("capture.html");

	videoWindow.setPosition(captureWindow.getPosition()[0] + 20, captureWindow.getPosition()[1] + 400);
	videoWindow2.setPosition(captureWindow.getPosition()[0] + 20, captureWindow.getPosition()[1] + 300);
	videoWindow3.setPosition(captureWindow.getPosition()[0] + 20, captureWindow.getPosition()[1] + 200);

	captureWindow.show();
	loadConfiguration();


	ipcMain.on("fullscreen", function () {
		const bounds = captureWindow.getBounds();

		if ((currentDisplay.bounds.x !== bounds.x || currentDisplay.bounds.y !== bounds.y || currentDisplay.bounds.height !== bounds.height || currentDisplay.bounds.width !== bounds.width)) {
			prefullScreenBounds = bounds;

			captureWindow.setPosition(currentDisplay.bounds.x, currentDisplay.bounds.y);
			captureWindow.setSize(currentDisplay.bounds.width, currentDisplay.bounds.height);
		} else {
			captureWindow.setPosition(prefullScreenBounds.x, prefullScreenBounds.y);
			captureWindow.setSize(prefullScreenBounds.width, prefullScreenBounds.height);
		}

		captureCurrentScreen();
		captureWindow.webContents.send("position", captureWindow.getPosition()[0] - currentDisplay.bounds.x, captureWindow.getPosition()[1] - currentDisplay.bounds.y);
	});

	ipcMain.on("quit", function () {
		app.exit(0);
	});

	ipcMain.on("changeVideo", function (event, sourceId, index) {
		const targetWindow = index === 1 ? videoWindow : index === 2 ? videoWindow2 : videoWindow3;

		if (sourceId === "none") {
			targetWindow.hide();
		} else {
			targetWindow.show();
		}
		targetWindow.webContents.send("device", sourceId);
	});

	ipcMain.on("preRecording", function () {
		const bounds = captureWindow.getBounds();
		oldWidth = bounds.width;
		oldHeight = bounds.height;
		oldX = bounds.x;
		oldY = bounds.y;

		indicatorWindow.setSize(oldWidth + 20, oldHeight + 20);
		indicatorWindow.setPosition(oldX - 10, oldY - 10);
		indicatorWindow.show();
		indicatorWindow.setSize(oldWidth + 20, oldHeight + 20);
		indicatorWindow.setPosition(oldX - 10, oldY - 10);
		setTimeout(() => {
			indicatorWindow.setAlwaysOnTop(true, "status");
			indicatorWindow.setSize(oldWidth + 20, oldHeight + 20);
			indicatorWindow.setPosition(oldX - 10, oldY - 10);
		}, 10);
		setTimeout(() => {
			indicatorWindow.setAlwaysOnTop(true, "status");
			indicatorWindow.setSize(oldWidth + 20, oldHeight + 20);
			indicatorWindow.setPosition(oldX - 10, oldY - 10);
		}, 500);
	});

	ipcMain.on("startRecording", function () {
		recording = true;

		videoWindow.webContents.send("startRecording");
		videoWindow2.webContents.send("startRecording");
		videoWindow3.webContents.send("startRecording");
		
		const bounds = captureWindow.getBounds();
		oldWidth = bounds.width;
		oldHeight = bounds.height;
		oldX = bounds.x;
		oldY = bounds.y;
		captureWindow.setSize(200, 40);
		captureWindow.setPosition(Math.floor(oldX + ((oldWidth - 200) / 2)), Math.max(-35, Math.floor(oldY - 50)));

		setTimeout(() => {
			captureWindow.setAlwaysOnTop(true, "status");
		}, 100);
	});

	ipcMain.on("stopRecording", function () {
		videoWindow.webContents.send("stopRecording");
		videoWindow2.webContents.send("stopRecording");
		videoWindow3.webContents.send("stopRecording");

		indicatorWindow.hide();
		captureWindow.setSize(oldWidth, oldHeight);
		captureWindow.setPosition(oldX, oldY);
		setTimeout(() => {
			captureWindow.setAlwaysOnTop(true, "status");
		}, 1000);
		recording = false;
	});

	ipcMain.on("loadSettings", function () {
		let storage = {};
		const storageFile = app.getPath('appData') + path.sep + "settings.json";
		if (fs.existsSync(storageFile)) {
			try {
				storage = JSON.parse(fs.readFileSync(storageFile).toString());
			} catch (e) {
				// do nothing, corrupt settings start anyway
				console.log(e);
			}
		}
		captureWindow.webContents.send("settings", storage);
	});

	ipcMain.on("saveSettings", function (event, settings) {
		console.log(JSON.stringify(settings));
		const storageFile = app.getPath('appData') + path.sep + "settings.json";
		console.log(storageFile);
		fs.writeFileSync(storageFile, JSON.stringify(settings));
	});

	if (os.platform() === "darwin") {
		systemPreferences.askForMediaAccess("camera");
		systemPreferences.askForMediaAccess("microphone");
	}

	videoWindow.on("resized", () => {
		saveConfiguration();
	});
	videoWindow.on("move", () => {
		saveConfiguration();
	});
	videoWindow2.on("resized", () => {
		saveConfiguration();
	});
	videoWindow2.on("move", () => {
		saveConfiguration();
	});
	videoWindow3.on("resized", () => {
		saveConfiguration();
	});
	videoWindow3.on("move", () => {
		saveConfiguration();
	});

	ipcMain.on("saveFile", (event, contents) => {
		console.log("Saving as : " +contents.format);
		const defaultPath = "recording-" + (Date.now()) + (contents.format !== "webm" ? ".mp4" : ".webm");
		const path = dialog.showSaveDialogSync(captureWindow, {
			defaultPath: defaultPath
		});

		if (path) {
			const webmPath = contents.format !== "webm" ? path+".webm" : path;

			fs.writeFileSync(webmPath, contents.data);
			if (contents.format !== "webm") {
				captureWindow.webContents.send("startSave");
				execFile(ffmpeg.path, [
					'-i', webmPath, 
					path
				], (error, stdout, stderr) => {
					if (error) {
						console.error(`exec error: ${error}`);
						return;
					}
					console.log(`stdout: ${stdout}`);
					console.error(`stderr: ${stderr}`);

					fs.unlinkSync(webmPath);
					captureWindow.webContents.send("endSave");
				});
			}
		}
	});

	captureWindow.on("resized", () => {
		if (!recording) {
			saveConfiguration();
		}
	});
	captureWindow.on("move", () => {
		captureCurrentScreen();

		if (currentDisplay) {
			captureWindow.webContents.send("position", captureWindow.getPosition()[0] - currentDisplay.bounds.x, captureWindow.getPosition()[1] - currentDisplay.bounds.y);
		}

		if (!recording) {
			saveConfiguration();
		}
	});

	captureWindow.webContents.on("did-finish-load", function () {
		captureCurrentScreen();
		captureWindow.webContents.send("position", captureWindow.getPosition()[0], captureWindow.getPosition()[1]);
	});

	videoWindow.webContents.on("did-finish-load", function() {
		videoWindow.webContents.send("path", app.getAppPath());
		
		const storageFile = app.getPath('appData') + path.sep + "avatar.svg";
		if (fs.existsSync(storageFile)) {
			const content = fs.readFileSync(storageFile).toString();
			videoWindow.webContents.send("avatar", content);
		};
	});
	videoWindow2.webContents.on("did-finish-load", function() {
		videoWindow2.webContents.send("path", app.getAppPath());
	});
	videoWindow3.webContents.on("did-finish-load", function() {
		videoWindow3.webContents.send("path", app.getAppPath());
	});
}

function captureCurrentScreen() {
	const bounds = captureWindow.getBounds();
	const nowDisplay = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });

	if (nowDisplay.id !== currentDisplay?.id) {
		currentDisplay = nowDisplay;

		console.log("Trying to get screen stream");
		desktopCapturer.getSources({ types: ["screen"] }).then(async sources => {
			for (const source of sources) {
				if (currentDisplay.id === parseInt(source.display_id)) {
					console.log("Sending screen stream");
					captureWindow.webContents.send("SET_SOURCE", source.id)
					break;
				}
			}
		})
	}
}

app.whenReady().then(() => {
	createWindow()

	globalShortcut.register('Shift+Escape', () => {
		captureWindow.webContents.send("doStop");
	})
	globalShortcut.register('Shift+Up', () => {
		const yp = recording ? oldY : captureWindow.getPosition()[1];
		videoWindow.setPosition(videoWindow.getPosition()[0], yp + 20)
	})
	globalShortcut.register('Shift+Down', () => {
		const yp = recording ? oldY : captureWindow.getPosition()[1];
		let captureWindowBounds = captureWindow.getBounds()
		let captureWindowHeight = recording ? oldHeight : captureWindowBounds.height
		let videoSize = videoWindow.getSize()
		videoWindow.setPosition(videoWindow.getPosition()[0], yp + captureWindowHeight - videoSize[1] - 20)
	})
	globalShortcut.register('Shift+Right', () => {
		const xp = recording ? oldX : captureWindow.getPosition()[0];
		let captureWindowBounds = captureWindow.getBounds()
		let captureWindowWidth = recording ? oldWidth : captureWindowBounds.width
		let videoSize = videoWindow.getSize()
		videoWindow.setPosition(xp + captureWindowWidth - videoSize[0] - 20, videoWindow.getPosition()[1])
	})
	globalShortcut.registerAll(['Shift+Left'], () => {
		const xp = recording ? oldX : captureWindow.getPosition()[0];
		videoWindow.setPosition(xp + 20, videoWindow.getPosition()[1])
	})

	app.on("activate", function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on("window-all-closed", function () {
	app.quit()
})
