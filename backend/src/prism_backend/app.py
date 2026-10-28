"""FastAPI application factory."""

from __future__ import annotations

from fastapi import FastAPI

from . import __version__
from .config import Settings
from .routers import ocr, pdf, system


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(title="PRISM Documents Backend", version=__version__)
    app.state.settings = settings
    app.include_router(system.router)
    app.include_router(pdf.router)
    app.include_router(ocr.router)
    return app
