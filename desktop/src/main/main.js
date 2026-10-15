'use strict';

const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('node:path');
const { Sidecar } = require('./sidecar');
const { registerIpc } = require('./ipc');

const isDev = !app.isPackaged;
const APP_ICON = path.join(__dirname, '..', '..', 'build', 'icon.png');
let sidecar = null;
let mainWindow = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    icon: APP_ICON,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Surface renderer problems in the main-process log during development.
  if (isDev) {
    mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
      if (level >= 2) console.error(`[renderer] ${message} (${source}:${line})`);
    });
    mainWindow.webContents.on('did-fail-load', (_e, code, desc) => console.error(`[renderer] load failed: ${desc} (${code})`));
    mainWindow.webContents.on('render-process-gone', (_e, details) => console.error('[renderer] gone:', details.reason));
  }

  await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(async () => {
  // Dock icon on macOS: the window `icon` option does not set the dock icon,
  // and in dev the dock shows Electron's icon unless we set it explicitly.
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(nativeImage.createFromPath(APP_ICON));
    } catch {
      /* non-fatal */
    }
  }

  sidecar = new Sidecar({ devMode: isDev, resourcesPath: process.resourcesPath });
  registerIpc(sidecar, () => mainWindow);

  // Start the window immediately; the backend comes up in parallel and the
  // renderer polls prism:status until it is ready.
  sidecar.start().catch((err) => console.error('Failed to start backend:', err.message));
  await createWindow();

  // Auto-update (packaged builds only). No-op in dev.
  if (!isDev) {
    const { initUpdater } = require('./updater');
    initUpdater();
  }

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
