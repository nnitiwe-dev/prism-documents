'use strict';

const { ipcMain, dialog } = require('electron');
const fs = require('node:fs/promises');

/**
 * Bridges the renderer to the backend. The renderer never holds the token or
 * the backend URL — every backend call is proxied here.
 */
function registerIpc(sidecar, getWindow) {
  ipcMain.handle('prism:status', async () => ({ ready: Boolean(sidecar.baseUrl) }));

  ipcMain.handle('prism:api', async (_event, { path, method, body }) => {
    try {
      const data = await sidecar.request(path, { method, body });
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message, status: err.status || 0 };
    }
  });

  ipcMain.handle('prism:openDialog', async (_event, options) => {
    return dialog.showOpenDialog(getWindow(), options || {});
  });

  ipcMain.handle('prism:saveDialog', async (_event, options) => {
    return dialog.showSaveDialog(getWindow(), options || {});
  });

  ipcMain.handle('prism:readFile', async (_event, filePath) => {
    const buf = await fs.readFile(filePath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  });

  ipcMain.handle('prism:writeFile', async (_event, { path, contents }) => {
    await fs.writeFile(path, contents, 'utf-8');
    return { ok: true };
  });
}

module.exports = { registerIpc };
