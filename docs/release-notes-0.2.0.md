## PRISM Documents 0.2.0 — Document intelligence

Local, optional AI features arrive, alongside robustness and cross-platform fixes.
Everything still runs on your machine.

### New

- **Extract text & OCR** (one tool, pick the method):
  - **Text layer** — instant, exact text/JSON from PDFs that already have text (default).
  - **Tesseract** — OCR scans into a searchable PDF or plain text.
  - **Docling** — layout + tables into Markdown/JSON (where supported).
  Results show inline with **Copy** / **Save…**, and each method shows exactly what
  it can and can't do.
- **Summarize** — summarize a document with a local model (llama.cpp).
- **Models** — see what your machine can run, with honest verdicts
  (*Runs comfortably / May lag / Not recommended*), and download models with progress.
- **Settings** — default method, default model, and download warnings.

### Fixed

- Packaged app failed to start the backend (now fixed on all OSes).
- Windows/Linux builds must be built on their own OS — a CI matrix now does this.
- CI build failure (Python 3.14 / no wheel) resolved.
- Clearer, intuitive error messages (no more raw "not valid JSON").

### Install

Pick your platform's file on the release page.

- **macOS** — `.dmg` (`arm64` for Apple Silicon, `x64` for Intel). Unsigned:
  drag to Applications, then right-click → **Open** once.
- **Windows** — `Setup .exe`. On SmartScreen: **More info → Run anyway**.
- **Linux** — `.AppImage`: `chmod +x`, then run.

First launch takes a few seconds while the local engine unpacks.

### Platform notes

Tesseract OCR and the Text-layer method work everywhere (Tesseract needs its
binary present). **Docling** needs PyTorch ≥ 2.4 — it runs on Apple Silicon,
Linux and Windows, **not Intel Macs**. The app always falls back to an engine
your machine can run.
