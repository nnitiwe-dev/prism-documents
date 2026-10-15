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

**Rebuild the backend after any backend change** (`./scripts/build-backend.sh`)
before `npm run dist:*` — the installer bundles the pre-built binary, not your
source. The PyInstaller entry (`__main__.py`) uses **absolute** imports so it
runs correctly as a frozen top-level script.

**If the packaged app shows no tools**, the backend process likely failed to
start. The renderer now falls back to a static tool registry so tools still
render, and the status bar shows "Backend unavailable". Diagnose from the
backend log written to the app's user-data directory:
`~/Library/Application Support/PRISM Documents/backend.log` (macOS). The sidecar
also accepts either copied layout (`Resources/backend/prism-backend`).

**Current caveats (Phase 1):** the PyInstaller hidden-import set covers
uvicorn/pdfplumber/pypdf but may need adjustment as backend deps grow. Code
signing/notarization (macOS) and an installer signing cert (Windows) are not yet
configured; without signing, an unsigned app run **from the DMG** may have its
spawned backend blocked by Gatekeeper — drag the app to `/Applications` and open
it once with right-click → Open. First launch is slower (~10s) while PyInstaller
unpacks, which is why the shell polls the backend for up to ~90s.

## Updates (VS Code–style, no self-hosted server)

Auto-update uses `electron-updater` with **GitHub Releases** as the feed
(`publish:` in `electron-builder.yml`). Installed apps check on launch, download
in the background, and install on restart — no reinstall. Because the Python
backend is bundled inside the app, an app update replaces the backend too; there
is no separate backend-update channel.

- Wiring lives in `desktop/src/main/updater.js`, initialized only when packaged.
- The real prerequisite is **code signing**: macOS requires a signed +
  notarized app for Squirrel.Mac to apply updates; Windows works unsigned but
  shows SmartScreen warnings until signed; Linux AppImage self-updates.
- A self-hosted or S3 feed is only worth adding later for staged rollouts or
  private channels.

## UI model: tool workspaces, one live view

Clicking a tool opens a dedicated **workspace page** (`toolpage.js`) rather than
a chain of native dialogs: add documents (drag-and-drop or picker), see
thumbnails + metadata, reorder by dragging, remove/replace, set the output name,
then run. The document tray (`tray.js`) is reusable across tools.

The shell mounts exactly **one** `{ element, destroy }` view at a time; mounting
a new one calls the previous view's `destroy()`. This guarantees no orphan pages
and frees resources on navigation. The viewer renders pages **lazily** via an
`IntersectionObserver` — only pages near the viewport hold a canvas, and the
PDF.js document is destroyed on exit — so large PDFs don't balloon RAM.
Thumbnails render page 1 then destroy the document immediately.

## Roadmap hooks

- **Models module (Phase 2):** `services/hardware.py` already returns a payload
  shaped to grow into GPU/VRAM detection, a model catalog, a memory-fit estimate,
  and a short on-device benchmark — surfaced in the existing Models panel.
- **New capabilities:** add a service + router + a `registry.py` entry, and the
  tool appears in the carousel, gallery, and command palette automatically.
