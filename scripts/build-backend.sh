#!/usr/bin/env bash
#
# Build the Python backend into a standalone binary so end users never need
# Python or uv installed. Output: backend/dist/prism-backend/ (onedir).
#
# The onedir layout is more reliable than --onefile for apps that bundle
# uvicorn/starlette/pdfplumber. electron-builder copies this folder into the
# app's resources (see desktop/electron-builder.yml).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../backend" && pwd)"

cd "$BACKEND_DIR"

echo "==> Building prism-backend with PyInstaller…"
uv run --with pyinstaller pyinstaller \
  --noconfirm \
  --clean \
  --name prism-backend \
  --paths src \
  --collect-submodules prism_backend \
  --collect-submodules uvicorn \
  --collect-all pdfplumber \
  --collect-all pdfminer \
  --collect-all pypdf \
  --hidden-import uvicorn.loops.auto \
  --hidden-import uvicorn.protocols.http.auto \
  --hidden-import uvicorn.protocols.websockets.auto \
  --hidden-import uvicorn.lifespan.on \
  src/prism_backend/__main__.py

echo "==> Done. Binary at: $BACKEND_DIR/dist/prism-backend/prism-backend"
