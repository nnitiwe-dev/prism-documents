"""System endpoints: readiness, capability registry, hardware profile."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from .. import __version__, registry
from ..intelligence import engines
from ..security import verify_token
from ..services import hardware, ocr

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    """Unauthenticated readiness probe used by the shell during startup."""
    return {"status": "ok", "version": __version__}


@router.get("/capabilities", dependencies=[Depends(verify_token)])
async def capabilities() -> dict:
    return registry.capabilities()


@router.get("/system/hardware", dependencies=[Depends(verify_token)])
async def system_hardware() -> dict:
    return hardware.profile()


@router.get("/system/engines", dependencies=[Depends(verify_token)])
async def system_engines() -> dict:
    """Capabilities and their engines, each with a per-machine verdict."""
    return engines.evaluate(hardware.profile(), ocr.tesseract_available())
