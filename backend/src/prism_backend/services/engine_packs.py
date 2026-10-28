"""Install optional engine packs (heavy, pip-installed) at runtime.

Currently supports Docling. Runs ``uv pip install`` into the backend's own venv in
a background thread (development). Not available in a PyInstaller-packaged build —
that needs a managed external environment (planned); we return a clear error.
"""

from __future__ import annotations

import subprocess
import threading
from pathlib import Path

from . import docling_engine

# backend project dir: .../backend/src/prism_backend/services/engine_packs.py
BACKEND_DIR = Path(__file__).resolve().parents[3]

PACKAGES: dict[str, list[str]] = {"docling": ["docling"]}
_state: dict[str, dict] = {}  # engine_id -> {status, error}


def status() -> dict:
    return {"installs": _state}


def install(engine_id: str) -> dict:
    if engine_id not in PACKAGES:
        raise ValueError(f"Unknown engine pack: {engine_id}")
    if docling_engine.is_frozen():
        raise RuntimeError("Engine packs can't be installed in the packaged app yet.")
    if engine_id == "docling" and not docling_engine.supported_platform():
        raise RuntimeError("Docling is not supported on this platform (needs PyTorch >= 2.4).")
    if _state.get(engine_id, {}).get("status") == "installing":
        return {"status": "installing"}
    _state[engine_id] = {"status": "installing", "error": None}
    threading.Thread(target=_run, args=(engine_id,), daemon=True).start()
    return {"status": "started"}


def _run(engine_id: str) -> None:
    try:
        subprocess.run(
            ["uv", "pip", "install", *PACKAGES[engine_id]],
            cwd=str(BACKEND_DIR),
            check=True,
            capture_output=True,
            text=True,
            timeout=1800,
            env={**_env(), "VIRTUAL_ENV": str(BACKEND_DIR / ".venv")},
        )
        _state[engine_id] = {"status": "done", "error": None}
    except subprocess.CalledProcessError as exc:
        _state[engine_id] = {"status": "error", "error": (exc.stderr or str(exc))[-400:]}
    except Exception as exc:  # noqa: BLE001
        _state[engine_id] = {"status": "error", "error": str(exc)}


def _env() -> dict:
    import os

    return dict(os.environ)
