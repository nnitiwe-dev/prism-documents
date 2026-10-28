"""User settings, persisted as JSON in the app's home directory.

Cross-platform (uses Path.home()), corruption-tolerant (bad/missing file falls
back to defaults), and written atomically.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

SETTINGS_DIR = Path.home() / ".prism-documents"
SETTINGS_PATH = SETTINGS_DIR / "settings.json"

DEFAULTS: dict = {
    "default_ocr_engine": "text-layer",   # method pre-selected on the Extract/OCR page
    "default_model": "",                   # summarization model id ("" = first installed)
    "warn_unrecommended": True,            # confirm before downloading a "Not recommended" model
    "theme": "system",                      # UI theme: system | light | dark (renderer applies)
}

ALLOWED_KEYS = set(DEFAULTS)


def load() -> dict:
    data = dict(DEFAULTS)
    try:
        if SETTINGS_PATH.is_file():
            stored = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
            if isinstance(stored, dict):
                for k, v in stored.items():
                    if k in ALLOWED_KEYS:
                        data[k] = v
    except Exception:
        pass  # corrupt/unreadable → defaults
    return data


def save(patch: dict) -> dict:
    data = load()
    for k, v in (patch or {}).items():
        if k in ALLOWED_KEYS:
            data[k] = v
    try:
        SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=str(SETTINGS_DIR), suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, SETTINGS_PATH)
    except Exception:
        pass  # best-effort; still return the merged view
    return data
