"""Local hardware profiling.

Phase 1 reports CPU, memory, and disk. GPU/VRAM detection and the model
compatibility engine are planned for the Models module (Phase 2); the shape of
this payload is designed to grow into that.
"""

from __future__ import annotations

import platform
import shutil
from pathlib import Path

import psutil


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
        "gpu": None,  # populated in Phase 2
    }
