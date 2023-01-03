const {app, BrowserWindow, ipcMain, screen} = require('electron')
const { desktopCapturer } = require('electron')

let videoWindow;
let captureWindow;
let oldWidth;
let oldHeight;
let oldX;
let oldY;

function createWindow() {
	videoWindow = new BrowserWindow({
		width: 200,
		height: 200,
		transparent: true,
		frame: false
	});
	videoWindow.setAlwaysOnTop(true, 'pop-up-menu');
	videoWindow.loadFile("video.html");

	captureWindow = new BrowserWindow({
		title: "Drag",
		width: 800,
		height: 600,
		transparent: true,
		frame: false,
		roundedCorners: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
	});
	captureWindow.setAlwaysOnTop(true, 'status');
	captureWindow.loadFile("capture.html");
	captureWindow.show();

	videoWindow.show();

	ipcMain.on('startRecording', function() {
		oldWidth = captureWindow.getSize()[0];
		oldHeight = captureWindow.getSize()[1];
		oldX = captureWindow.getPosition()[0];
		oldY = captureWindow.getPosition()[1];

		const primaryDisplay = screen.getPrimaryDisplay()
		const size = primaryDisplay.workAreaSize

		captureWindow.setSize(200,40);
		captureWindow.setPosition(size.width - 200, 40);
	});

	ipcMain.on('stopRecording', function() {
		captureWindow.setSize(oldWidth,oldHeight);
		captureWindow.setPosition(oldX, oldY);
	});

	captureWindow.webContents.on('did-finish-load', function() {
		desktopCapturer.getSources({ types: ['screen'] }).then(async sources => {
		  for (const source of sources) {
			captureWindow.webContents.send('SET_SOURCE', source.id)
			break;
		  }
		})
	});
}

app.whenReady().then(() => {
  createWindow()
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  app.quit()
})
