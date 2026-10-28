"""Local hardware profiling.

Phase 1 reports CPU, memory, and disk. GPU/VRAM detection and the model
compatibility engine are planned for the Models module (Phase 2); the shape of
this payload is designed to grow into that.
"""

from __future__ import annotations

import platform
import shutil
import subprocess
from pathlib import Path

import psutil


def _detect_gpu() -> dict | None:
    """Best-effort GPU detection. Conservative: only report what we can confirm."""
    system = platform.system()
    if system == "Darwin" and platform.machine() == "arm64":
        # Apple Silicon: Metal GPU with unified memory.
        return {"type": "apple-metal", "name": "Apple Silicon GPU", "unified_memory": True}
    if shutil.which("nvidia-smi"):
        try:
            out = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=5, check=False,
            )
            line = out.stdout.strip().splitlines()[0]
            name, vram_mb = (x.strip() for x in line.split(","))
            return {"type": "cuda", "name": name, "vram_mb": int(float(vram_mb))}
        except Exception:
            return {"type": "cuda", "name": "NVIDIA GPU"}
    return None


def profile() -> dict:
    vm = psutil.virtual_memory()
    try:
        disk_free = shutil.disk_usage(Path.home()).free
    except Exception:
        disk_free = 0
    return {
        "os": platform.system(),
        "os_version": platform.release(),
        "arch": platform.machine(),
        "cpu": platform.processor() or platform.machine(),
        "cpu_cores_logical": psutil.cpu_count(logical=True),
        "cpu_cores_physical": psutil.cpu_count(logical=False),
        "ram_total_bytes": vm.total,
        "ram_available_bytes": vm.available,
        "disk_free_bytes": disk_free,
        "gpu": _detect_gpu(),
    }
