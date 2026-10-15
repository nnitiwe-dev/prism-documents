'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { Sidecar } = require('./sidecar');
const { registerIpc } = require('./ipc');

const isDev = !app.isPackaged;
let sidecar = null;
let mainWindow = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(async () => {
  sidecar = new Sidecar({ devMode: isDev, resourcesPath: process.resourcesPath });
  registerIpc(sidecar, () => mainWindow);

  // Start the window immediately; the backend comes up in parallel and the
  // renderer polls prism:status until it is ready.
  sidecar.start().catch((err) => console.error('Failed to start backend:', err.message));
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (sidecar) sidecar.stop();
});
