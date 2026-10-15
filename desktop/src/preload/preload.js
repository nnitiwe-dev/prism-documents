'use strict';

const { contextBridge, ipcRenderer } = require('electron');

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
  platform: process.platform,
});
