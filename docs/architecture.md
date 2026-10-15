# Architecture

PRISM Documents is built as a **thin shell over a capability registry**, so that
new features — document intelligence, data visualization, productivity — are
added as modules rather than rewrites.

## Layers

```
┌──────────────────────────────────────────────────────────────┐
│ Electron shell (desktop/src/main, desktop/src/renderer)        │
│  • window, activity bar, sidebar, tabs, command palette (⌘K)   │
│  • renders every surface from the capability registry          │
└───────────────┬────────────────────────────────────────────────┘
                │  IPC proxy (main process holds token + URL)
                │  local HTTP: http://127.0.0.1:<ephemeral> + X-Prism-Token
┌───────────────▼────────────────────────────────────────────────┐
│ Python backend (backend/src/prism_backend)                      │
│  • routers → services (pdf_ops, extraction, hardware)           │
│  • capability registry (single source of truth for tools)       │
│  • runtime/hardware abstraction (grows into the Models module)  │
└───────────────┬────────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────────┐
│ The user's PC — files, CPU/GPU/RAM, (later) local GGUF models   │
└──────────────────────────────────────────────────────────────┘
```

## Why local HTTP (not stdio)

The Electron↔Python transport is independent of how Python will later talk to a
local LLM. We chose HTTP over stdio because the roadmap needs:

- **Concurrency** — agentic multi-step loops and background jobs (benchmarks,
  batch extraction) while the UI stays responsive. HTTP multiplexes requests;
  stdio would require hand-rolled framing and backpressure.
- **Streaming** — token-by-token output and progress via SSE/WebSocket (native
  over HTTP).
- **A reusable API surface** — the same backend could serve a future web or
  remote mode.

## Why these PDF libraries

All permissively licensed to preserve the MIT license and freely redistributable
installers:

- **pypdf** (BSD) — merge, split, rotate, reorder, delete pages, document info.
- **pdfplumber** (MIT) — text extraction.
- **PDF.js** (Apache-2.0) — in-app rendering in the renderer.

**PyMuPDF is deliberately avoided** (AGPL/commercial). See
[../THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## The sidecar handshake

1. Electron generates a random per-session token and spawns the backend with it
   in the `PRISM_AUTH_TOKEN` env var (never on argv, never sent to the renderer).
2. The backend binds a socket to `127.0.0.1:0`; the OS assigns a free port. This
   is what guarantees no collision with other local apps.
3. The backend prints one JSON line to stdout:
   `{"event":"prism-backend-ready","host":"127.0.0.1","port":<n>,"pid":<n>}`.
4. Electron reads that line, stores `http://127.0.0.1:<n>`, and proxies renderer
   requests to it with the token header. The renderer polls `/health` (the only
   unauthenticated route) until ready.

## Data flow for operations

Operations pass **file paths**, not uploaded bytes — the shell and backend share
the machine, so this avoids copying large PDFs over loopback and keeps memory
low. Viewing is handled entirely in the renderer (PDF.js reads file bytes via an
IPC `readFile`), so opening a document needs no backend round trip.

## Packaging

End users should not need Python or uv:

1. `scripts/build-backend.sh` uses PyInstaller to produce a standalone
   `backend/dist/prism-backend/` (onedir).
2. `electron-builder` bundles that folder into the app's resources and produces
   platform installers (`.dmg`/`.zip` on macOS, NSIS `.exe` on Windows,
   `AppImage`/`.deb` on Linux).
3. In production, `sidecar.js` spawns the bundled binary instead of `uv run`.

**Current caveats (Phase 1):** the PyInstaller hidden-import set covers
uvicorn/pdfplumber/pypdf but may need adjustment as backend deps grow; code
signing/notarization (macOS) and an installer signing cert (Windows) are not yet
configured and are required for friction-free installation on those platforms.

## Roadmap hooks

- **Models module (Phase 2):** `services/hardware.py` already returns a payload
  shaped to grow into GPU/VRAM detection, a model catalog, a memory-fit estimate,
  and a short on-device benchmark — surfaced in the existing Models panel.
- **New capabilities:** add a service + router + a `registry.py` entry, and the
  tool appears in the carousel, gallery, and command palette automatically.
