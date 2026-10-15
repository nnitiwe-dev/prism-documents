'use strict';

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');

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
  constructor({ devMode, resourcesPath }) {
    this.token = crypto.randomBytes(32).toString('hex');
    this.devMode = devMode;
    this.resourcesPath = resourcesPath;
    this.proc = null;
    this.baseUrl = null;
  }

  _spawnTarget() {
    const env = { ...process.env, PRISM_AUTH_TOKEN: this.token };
    if (this.devMode) {
      return {
        command: 'uv',
        args: ['run', 'prism-backend', '--host', '127.0.0.1'],
        options: { cwd: path.join(__dirname, '..', '..', '..', 'backend'), env },
      };
    }
    const bin = process.platform === 'win32' ? 'prism-backend.exe' : 'prism-backend';
    return {
      command: path.join(this.resourcesPath, 'backend', bin),
      args: ['--host', '127.0.0.1'],
      options: { env },
    };
  }

  start() {
    return new Promise((resolve, reject) => {
      const { command, args, options } = this._spawnTarget();
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
      this.proc.stderr.on('data', (d) => console.error('[backend]', d.toString().trim()));
      this.proc.on('error', finishErr);
      this.proc.on('exit', (code) => {
        if (!this.baseUrl) finishErr(new Error(`backend exited before ready (code ${code})`));
      });

      setTimeout(() => finishErr(new Error('backend startup timed out')), STARTUP_TIMEOUT_MS);
    });
  }

  async request(pathname, { method = 'GET', body } = {}) {
    if (!this.baseUrl) throw new Error('backend is not ready');
    const res = await fetch(this.baseUrl + pathname, {
      method,
      headers: { 'X-Prism-Token': this.token, 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error((data && data.detail) || res.statusText);
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
