#!/usr/bin/env bash
#
# Developer launch: install deps if needed, then start the Electron app, which
# spawns the Python backend via `uv run` automatically.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Syncing backend (uv)…"
(cd "$ROOT/backend" && uv sync --extra dev)

echo "==> Installing desktop dependencies (npm)…"
(cd "$ROOT/desktop" && npm install)

echo "==> Launching PRISM Documents…"
(cd "$ROOT/desktop" && npm start)
