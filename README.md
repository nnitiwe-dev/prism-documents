<div align="center">

# PRISM Documents

**Open-source, local-first document intelligence — by [PRISM Data Studio](https://www.prismdatastudio.com/)**

Understand your documents. Work with them. Extract what matters — all on your own machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Status: Phase 1 (MVP)](https://img.shields.io/badge/status-phase%201%20MVP-orange.svg)

</div>

---

PRISM Documents is a cross-platform desktop app for working with PDFs — and, over
time, a local workspace for document intelligence (extraction, OCR, Q&A),
data visualization, and personal productivity. Everything runs on your device;
nothing is uploaded unless you explicitly opt in.

This repository is **Phase 1**: a dependable PDF utility with the modular
architecture the rest of the vision plugs into.

## Download

Grab the latest installer for your platform from the
**[Releases page](https://github.com/nnitiwe-dev/prism-documents/releases/latest)**:

On the [Releases page](https://github.com/nnitiwe-dev/prism-documents/releases/latest), pick the file for your platform:

| Platform | File |
|----------|------|
| macOS | `.dmg` (choose `arm64` for Apple Silicon, `x64` for Intel) |
| Windows | `PRISM-Documents-Setup-*.exe` |
| Linux | `.AppImage` |

The app is **not yet code-signed**, so your OS will warn on first launch:

- **macOS** — drag the app to `Applications`, then right-click it → **Open** (once). If it's still blocked, run `xattr -dr com.apple.quarantine "/Applications/PRISM Documents.app"`.
- **Windows** — on the SmartScreen prompt, click **More info → Run anyway**.
- **Linux** — make the AppImage executable: `chmod +x "PRISM Documents-0.1.0-x86_64.AppImage"`, then run it.

First launch takes ~10s while the local engine unpacks. Everything runs on your machine; nothing is uploaded.

## Features

**PDF tools**
- 📄 **View** — open, read, zoom, navigate, select text, and find in PDFs
- 🧩 **Merge**, ✂️ **Split**, 🔄 **Rotate**, **Reorder**, and **Remove** pages — lossless

**Document intelligence (local, optional)**
- 🔤 **Extract text & OCR** — one tool, pick the method: *Text layer* (instant),
  *Tesseract* (OCR → searchable PDF / text), or *Docling* (layout + tables →
  Markdown / JSON). Copy or export the result.
- 🧠 **Summarize** — summarize a document with a local model via llama.cpp
- 🖥️ **Models** — reads your hardware and rates each engine/model
  *Runs comfortably / May lag / Not recommended*; download models with progress
- ⚙️ **Settings** — default method, default model, download warnings

**Shell** — VS Code–style activity bar + command palette (`⌘K` / `Ctrl+K`)

> Engines degrade gracefully by platform: Tesseract and the Text layer work
> everywhere; Docling needs PyTorch ≥ 2.4 (Apple Silicon / Linux / Windows — not
> Intel Macs). The app always falls back to what your machine can run.

## Architecture at a glance

A thin **Electron shell** renders everything from a **capability registry**
(the single source of truth for tools). It talks to a **Python FastAPI backend**
over loopback HTTP; the backend performs PDF operations and, later, document
intelligence on top of a runtime/hardware abstraction.

```
Electron shell  ──local HTTP (127.0.0.1 + token)──►  Python backend  ──►  your PC
(UI + registry)                                      (PDF ops, etc.)      (models, CPU/GPU)
```

The backend binds to `127.0.0.1` on an **OS-assigned ephemeral port** (so it can
never collide with another app) and authenticates **every** request with a
per-session token. The renderer never holds the token — all backend calls are
proxied through the Electron main process. See [docs/architecture.md](docs/architecture.md).

## Getting started (development)

Prerequisites: [uv](https://docs.astral.sh/uv/), Node.js 18+, and npm.

```bash
# one command: syncs the backend, installs the desktop deps, launches the app
./scripts/dev.sh
```

Or step by step:

```bash
# backend
cd backend
uv sync --extra dev
uv run pytest            # 31 tests

# desktop (in another shell)
cd ../desktop
npm install
npm start
```

In development the Electron app launches the backend with `uv run` automatically.

## Building installers

End users should not need Python or uv. The backend is compiled to a standalone
binary and bundled inside the app:

```bash
./scripts/build-backend.sh          # PyInstaller → backend/dist/prism-backend/
cd desktop
npm run dist:mac                    # .dmg + .zip   (or dist:win / dist:linux)
```

Output installers land in `desktop/dist/`. See [docs/architecture.md](docs/architecture.md)
for the packaging notes and current caveats.

## Project layout

```
prism-documents/
├── backend/         # Python FastAPI service (uv-managed), PDF ops + tests
├── desktop/         # Electron shell (main process + renderer UI)
├── docs/            # architecture and design notes
├── scripts/         # dev + build helpers
└── LICENSE          # MIT
```

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and our
[Code of Conduct](CODE_OF_CONDUCT.md). Found a security issue? See [SECURITY.md](SECURITY.md).

## License

MIT © 2026 Samuel Theophilus. See [LICENSE](LICENSE).

All runtime dependencies are permissively licensed to keep PRISM Documents
freely redistributable; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

> “PRISM” and the PRISM logo are brand assets of PRISM Data Studio. The MIT
> license covers the source code, not the name or logo.
