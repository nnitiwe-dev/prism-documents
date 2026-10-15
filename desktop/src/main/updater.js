'use strict';

const { dialog } = require('electron');

/**
 * VS Code–style auto-update via electron-updater reading from GitHub Releases.
 * No self-hosted server is required. This is a no-op in development and only
 * actually applies updates for a packaged, code-signed build (macOS in
 * particular requires signing + notarization for Squirrel.Mac to accept them).
 */
function initUpdater() {
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    return; // dependency not installed (e.g. dev) — skip quietly
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => console.error('[updater]', err && err.message ? err.message : err));

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      message: `PRISM Documents ${info.version} is ready`,
      detail: 'Restart to finish installing the update. Your work is saved locally.',
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdates().catch((err) =>
    console.error('[updater] check failed:', err && err.message ? err.message : err),
  );
}

module.exports = { initUpdater };
