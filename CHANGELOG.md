# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [0.2.0]

### Added

- **Extract text & OCR** — a single tool (replacing the separate "Extract text"
  and "OCR scan") with a method picker and output formats:
  - *Text layer* (pdfplumber): instant text / JSON — the default.
  - *Tesseract*: searchable PDF / plain text.
  - *Docling*: Markdown / JSON / text (layout + tables).
  Text results show inline with **Copy** and **Save…**; each engine shows a
  transparent capability + limits card.
- **Summarize** — summarize a document with a local model via **llama.cpp**.
- **Models** screen — hardware "Your PC" card, engines and a downloadable model
  catalog (SmolLM2, Qwen2.5, Llama 3.2) each with a per-machine verdict
  (*Runs comfortably / May lag / Not recommended*), download progress and removal.
- **Settings** — default extract/OCR method, default summarization model, and a
  "warn before downloading a not-recommended model" toggle (persisted locally).
- Model recommendation/compatibility engine (memory estimate + verdict).
- Home tools grouped into rows ("Essential PDF tools", "Content understanding").
- CI **release** workflow that builds the backend + installer natively per OS.

### Changed

- Removed the redundant "Export PDF" tool.
- PDF pages render at `devicePixelRatio` for crisp Retina/HiDPI output.
- Viewer gained a navigation pane (outline / page list) and a selectable text layer.

### Fixed

- Packaged backend crashed on launch (relative import) — now boots on all OSes.
- Cross-platform builds: each OS builds its own native backend (can't cross-build).
- CI used CPython 3.14 (no llama-cpp wheel) — capped `requires-python` to `<3.14`.
- IPC no longer surfaces "not valid JSON" on backend errors; alerts show the real
  message.

### Platform notes

- Tesseract OCR and the Text layer work on all platforms (Tesseract needs its
  binary present). Docling requires PyTorch ≥ 2.4 and runs on Apple Silicon /
  Linux / Windows, **not** Intel Macs; the app auto-selects an engine the machine
  can run and falls back to Tesseract / Text layer.

## [Unreleased]

### Added — Phase 1 (PDF essentials MVP)

- Electron shell with a VS Code–style activity bar, sidebar, and command palette.
- Home screen with a tools carousel, category filter, "Explore all tools", and
  a recent-documents grid.
- In-app PDF viewer (PDF.js): render, zoom, page navigation, and basic text find.
- Python FastAPI backend (uv-managed) with PDF operations:
  merge, split, rotate, reorder, remove pages, extract text, and document info.
- Capability registry as the single source of truth for tools.
- Secure local sidecar: loopback-only binding, OS-assigned ephemeral port,
  per-session token auth, and a renderer that never holds the token.
- Hardware profile endpoint and a Models panel (groundwork for Phase 2).
- Backend test suite (31 tests) and ruff linting.
- Packaging configuration (electron-builder) and a PyInstaller backend build script.
- Open-source docs: README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY,
  THIRD_PARTY_NOTICES.

### Changed

- Tools now open a dedicated workspace page (drag-and-drop documents, thumbnail
  previews with page count/size, drag-to-reorder, remove/replace, editable
  output name) instead of a chain of native dialogs.
- View host mounts one view at a time and destroys the previous one — no orphan
  pages; the viewer renders pages lazily and frees them on exit to bound RAM.
- `/pdf/info` now returns `size_bytes`.
- Added `electron-updater` auto-update scaffolding (GitHub Releases feed),
  active in packaged, signed builds.

[Unreleased]: https://github.com/nnitiwe/prism-documents/commits/main
