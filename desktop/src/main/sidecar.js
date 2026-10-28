'use strict';

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const READY_EVENT = 'prism-backend-ready';
const STARTUP_TIMEOUT_MS = 30000;

/**
 * Manages the Python backend process.
 *
 * Security model:
 *  - We generate a per-session token and pass it via the PRISM_AUTH_TOKEN env
 *    var (never on argv, never exposed to the renderer).
 *  - The backend binds to 127.0.0.1:0, so the OS assigns a free port that can
 *    never collide with another app. We learn the port from the single JSON
 *    "ready" line the backend prints to stdout.
 *  - The renderer never sees the token or the URL; it talks to the backend only
 *    through the main-process IPC proxy (see ipc.js).
 */
class Sidecar {
  constructor({ devMode, resourcesPath, logPath }) {
    this.token = crypto.randomBytes(32).toString('hex');
    this.devMode = devMode;
    this.resourcesPath = resourcesPath;
    this.logPath = logPath || null;
    this.proc = null;
    this.baseUrl = null;
  }

  _spawnTarget() {
    const env = { ...process.env, PRISM_AUTH_TOKEN: this.token };
    // A GUI-launched app inherits a stripped PATH that often omits the dirs where
    // Homebrew / user tools (e.g. tesseract) live. Add the common locations so
    // the backend can find system binaries like tesseract and ghostscript.
    if (process.platform !== 'win32') {
      const home = process.env.HOME || '';
      const extra = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', `${home}/.local/bin`];
      env.PATH = [env.PATH, ...extra].filter(Boolean).join(':');
    }
    if (this.devMode) {
      return {
        command: 'uv',
        args: ['run', 'prism-backend', '--host', '127.0.0.1'],
        options: { cwd: path.join(__dirname, '..', '..', '..', 'backend'), env },
      };
    }
    // PyInstaller onedir output copied by electron-builder; accept either layout.
    const bin = process.platform === 'win32' ? 'prism-backend.exe' : 'prism-backend';
    const candidates = [
      path.join(this.resourcesPath, 'backend', bin),
      path.join(this.resourcesPath, 'backend', 'prism-backend', bin),
    ];
    const command = candidates.find((p) => fs.existsSync(p)) || candidates[0];
    return { command, args: ['--host', '127.0.0.1'], options: { env } };
  }

  start() {
    return new Promise((resolve, reject) => {
      const { command, args, options } = this._spawnTarget();

      const log = this.logPath ? fs.createWriteStream(this.logPath, { flags: 'a' }) : null;
      const writeLog = (s) => { if (log) { try { log.write(s); } catch { /* noop */ } } };
      writeLog(`\n[${new Date().toISOString()}] launching: ${command} ${args.join(' ')}\n`);

      this.proc = spawn(command, args, options);

      let settled = false;
      let buffer = '';

      const finishOk = (host, port) => {
        settled = true;
        this.baseUrl = `http://${host}:${port}`;
        this.proc.stdout.removeListener('data', onStdout);
        resolve({ baseUrl: this.baseUrl });
      };
      const finishErr = (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      const onStdout = (chunk) => {
        writeLog(chunk);
        buffer += chunk.toString();
        let nl;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.event === READY_EVENT) {
              finishOk(msg.host, msg.port);
              return;
            }
          } catch {
            // non-JSON log line from the backend; ignore
          }
        }
      };

      this.proc.stdout.on('data', onStdout);
      this.proc.stderr.on('data', (d) => { writeLog(d); console.error('[backend]', d.toString().trim()); });
      this.proc.on('error', (err) => { writeLog(`spawn error: ${err.message}\n`); finishErr(err); });
      this.proc.on('exit', (code) => {
        writeLog(`exited with code ${code}\n`);
        if (!this.baseUrl) finishErr(new Error(`backend exited before ready (code ${code})`));
      });

      setTimeout(() => finishErr(new Error('backend startup timed out')), STARTUP_TIMEOUT_MS);
    });
  }

  async request(pathname, { method = 'GET', body } = {}) {
    if (!this.baseUrl) throw new Error('The local engine is still starting — try again in a moment.');
    const res = await fetch(this.baseUrl + pathname, {
      method,
      headers: { 'X-Prism-Token': this.token, 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null; // non-JSON body (e.g. a plain "Internal Server Error")
      }
    }
    if (!res.ok) {
      const detail = (data && data.detail) || (text && text.trim().slice(0, 300)) || res.statusText;
      const err = new Error(detail);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  stop() {
    if (this.proc && !this.proc.killed) {
      this.proc.kill();
      this.proc = null;
    }
  }
}

module.exports = { Sidecar };
