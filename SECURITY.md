# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report privately via GitHub's **"Report a vulnerability"** (Security
Advisories) on this repository. Include:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- affected version/commit.

We aim to acknowledge reports within a few days and will coordinate a fix and
disclosure timeline with you.

## Design notes relevant to security

PRISM Documents is **local-first**. The desktop app runs a local backend with
the following protections:

- The backend binds **only** to `127.0.0.1` (loopback) — it is never exposed to
  the network or other machines.
- It listens on an **OS-assigned ephemeral port**, avoiding collisions and fixed
  ports that other local software could target.
- **Every** request except the `/health` readiness probe requires a per-session
  token (`X-Prism-Token`), generated fresh on each launch and compared in
  constant time.
- The token and backend URL are held only by the Electron main process. The
  renderer has **no** direct network access and reaches the backend solely
  through a narrow IPC proxy (`contextIsolation` on, `nodeIntegration` off,
  `sandbox` on).
- A strict Content-Security-Policy is applied to the renderer.

If you believe any of these protections can be bypassed, please report it as
described above.
