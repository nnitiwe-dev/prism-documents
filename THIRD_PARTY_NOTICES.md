# Third-Party Notices

PRISM Documents is distributed under the MIT License. It bundles or depends on
the following third-party components. Every runtime dependency is permissively
licensed to keep the project freely redistributable. License texts are available
from each project.

## Backend (Python)

| Component | Purpose | License |
|-----------|---------|---------|
| [FastAPI](https://github.com/fastapi/fastapi) | HTTP framework | MIT |
| [Starlette](https://github.com/encode/starlette) | ASGI toolkit | BSD-3-Clause |
| [Uvicorn](https://github.com/encode/uvicorn) | ASGI server | BSD-3-Clause |
| [Pydantic](https://github.com/pydantic/pydantic) | Data validation | MIT |
| [pypdf](https://github.com/py-pdf/pypdf) | PDF page operations | BSD-3-Clause |
| [pdfplumber](https://github.com/jsvine/pdfplumber) | Text/table extraction | MIT |
| [pdfminer.six](https://github.com/pdfminer/pdfminer.six) | PDF parsing (via pdfplumber) | MIT |
| [psutil](https://github.com/giampaolo/psutil) | Hardware profiling | BSD-3-Clause |

## Desktop (JavaScript)

| Component | Purpose | License |
|-----------|---------|---------|
| [Electron](https://github.com/electron/electron) | Desktop shell | MIT |
| [PDF.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`) | In-app PDF rendering | Apache-2.0 |
| [electron-builder](https://github.com/electron-userland/electron-builder) | Packaging (build-time) | MIT |

## Deliberately avoided

- **PyMuPDF (fitz)** — AGPL-3.0 / commercial. Excluded because its copyleft terms
  are incompatible with shipping an MIT-licensed, freely redistributable app.
  We use `pypdf` + `pdfplumber` + PDF.js instead.

---

This list is maintained on a best-effort basis. If you spot an omission or error,
please open an issue or pull request.
