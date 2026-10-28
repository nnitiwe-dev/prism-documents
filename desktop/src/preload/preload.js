'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

/**
 * The only surface the renderer can touch. No token, no backend URL, no Node
 * APIs leak into the page.
 */
contextBridge.exposeInMainWorld('prism', {
  status: () => ipcRenderer.invoke('prism:status'),
  api: (path, options = {}) =>
    ipcRenderer.invoke('prism:api', {
      path,
      method: options.method || 'GET',
      body: options.body,
    }),
  openDialog: (options) => ipcRenderer.invoke('prism:openDialog', options),
  saveDialog: (options) => ipcRenderer.invoke('prism:saveDialog', options),
  readFile: (filePath) => ipcRenderer.invoke('prism:readFile', filePath),
  writeFile: (path, contents) => ipcRenderer.invoke('prism:writeFile', { path, contents }),
  // Resolve the absolute path of a File dropped from the OS (Electron 33
  // removed File.path; webUtils is the supported replacement and is available
  // in sandboxed preloads).
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
  platform: process.platform,
});
