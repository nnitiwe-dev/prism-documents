## PRISM Documents 0.2.1 — Document intelligence

Local, optional AI features arrive alongside the PDF tools. Everything runs on
your machine — nothing is uploaded.

### New

- **Extract text & OCR** — one tool, pick the method:
  - **Text layer** — instant, exact text/JSON from PDFs that already have text (default).
  - **Tesseract** — OCR scans into a searchable PDF or plain text.
  - **Docling** — layout + tables into Markdown/JSON (on supported platforms).

  Results show inline with **Copy** / **Save…**, and each method shows a clear
  card of what it can and can't do.
- **Summarize** — summarize a document with a local model (llama.cpp).
- **Models** — see what your machine can run, with honest verdicts
  (*Runs comfortably / May lag / Not recommended*), and download models with progress.
- **Settings** — default method, default model, and download warnings.

### Download

Pick your platform's file below.

- **macOS** — `.dmg` (Intel build; also runs on Apple Silicon via Rosetta).
  Unsigned: drag to Applications, then right-click → **Open** once.
- **Windows** — `Setup .exe`. On SmartScreen: **More info → Run anyway**.
- **Linux** — `.AppImage`: `chmod +x`, then run.

First launch takes a few seconds while the local engine unpacks.

### Notes

- Not code-signed yet, so first-launch OS warnings are expected.
- **Tesseract OCR** needs the `tesseract` binary present; the **Text layer**
  method and **Summarize** work out of the box.
- **Docling** needs PyTorch ≥ 2.4, so it runs on Apple Silicon / Linux / Windows,
  **not Intel Macs**. The app always falls back to an engine your machine can run.

### Fixes

- Cross-platform release builds, clearer error messages, and robust fallbacks
  across macOS / Windows / Linux. (0.2.0 was tagged but never shipped due to
  build issues; 0.2.1 is the first published 0.2.x.)
