"""Model download manager: resumable-ish background downloads of GGUF models to a
local models directory, with progress, install status, and removal.
"""

from __future__ import annotations

import threading
import urllib.request
from pathlib import Path

from ..intelligence import catalog

MODELS_DIR = Path.home() / ".prism-documents" / "models"
_downloads: dict[str, dict] = {}  # model_id -> {status, downloaded, total, error}
_lock = threading.Lock()


def model_path(model: dict) -> Path:
    return MODELS_DIR / model["filename"]


def is_installed(model: dict) -> bool:
    p = model_path(model)
    return p.is_file() and p.stat().st_size >= int(model["size_bytes"] * 0.98)


def status() -> dict:
    rows = []
    for m in catalog.MODELS:
        d = _downloads.get(m["id"])
        rows.append({
            "id": m["id"],
            "installed": is_installed(m),
            "downloading": bool(d and d["status"] == "downloading"),
            "progress": d,
        })
    return {"models": rows}


def start_download(model_id: str) -> dict:
    model = catalog.get(model_id)
    if not model:
        raise ValueError("unknown model")
    if is_installed(model):
        return {"status": "installed"}
    with _lock:
        if _downloads.get(model_id, {}).get("status") == "downloading":
            return {"status": "downloading"}
        _downloads[model_id] = {
            "status": "downloading", "downloaded": 0, "total": model["size_bytes"], "error": None,
        }
    threading.Thread(target=_download, args=(model,), daemon=True).start()
    return {"status": "started"}


def _download(model: dict) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    dest = model_path(model)
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        req = urllib.request.Request(model["url"], headers={"User-Agent": "prism-documents"})
        with urllib.request.urlopen(req) as r, open(tmp, "wb") as f:  # noqa: S310 - https HF URL
            total = int(r.headers.get("Content-Length") or model["size_bytes"])
            _downloads[model["id"]]["total"] = total
            downloaded = 0
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                _downloads[model["id"]]["downloaded"] = downloaded
        tmp.rename(dest)
        _downloads[model["id"]]["status"] = "done"
    except Exception as exc:  # noqa: BLE001
        _downloads[model["id"]] = {
            "status": "error", "downloaded": 0, "total": model["size_bytes"], "error": str(exc),
        }
        try:
            tmp.unlink()
        except OSError:
            pass


def remove(model_id: str) -> dict:
    model = catalog.get(model_id)
    if not model:
        raise ValueError("unknown model")
    p = model_path(model)
    if p.is_file():
        p.unlink()
    _downloads.pop(model_id, None)
    return {"removed": True}
