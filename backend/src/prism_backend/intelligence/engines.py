"""Capability → engine registry.

A *capability* (e.g. OCR) is provided by one or more *engines*. Each engine
declares its runtime, availability (bundled vs an on-demand pack), hardware
requirements, and license. Feature screens let the user pick an engine; the
Models screen shows each engine with a per-machine verdict. See
docs/intelligence-and-models.md.
"""

from __future__ import annotations

from . import compat

CAPABILITIES: list[dict] = [
    {"id": "ocr", "label": "OCR / text recognition"},
    {"id": "extraction", "label": "Structured extraction"},
    {"id": "summarize", "label": "Summarize & Q&A"},
]

# availability: "bundled" (ships / uses a system tool) | "pack" (on-demand download)
# status is derived at runtime (available / needs-install / planned).
ENGINES: list[dict] = [
    {
        "id": "tesseract",
        "capability": "ocr",
        "name": "Tesseract",
        "description": "Fast CPU OCR for clean printed text; searchable PDF or plain text.",
        "runtime": "tesseract",
        "availability": "bundled",
        "requirements": {"min_ram_gb": 0.5, "recommends_gpu": False, "disk_mb": 0},
        "license": "Apache-2.0",
        "outputs": ["searchable-pdf", "text"],
        "capabilities": [
            {"feature": "Searchable PDF", "supported": True},
            {"feature": "Plain text", "supported": True},
            {"feature": "Tables", "supported": False},
            {"feature": "Markdown", "supported": False},
            {"feature": "JSON fields", "supported": False},
            {"feature": "Layout analysis", "supported": False},
            {"feature": "Image captions", "supported": False},
        ],
        "limits": "Best on clean printed text. No tables, Markdown, layout or image understanding.",
        "default": True,
    },
    {
        "id": "paddleocr-vl",
        "capability": "ocr",
        "name": "PaddleOCR-VL",
        "description": "Vision model: mixed scans → Markdown, strong on tables. GPU recommended.",
        "runtime": "python-torch",
        "availability": "pack",
        "requirements": {"min_ram_gb": 4, "recommends_gpu": True, "disk_mb": 1500},
        "license": "Apache-2.0",
        "outputs": ["markdown", "text"],
        "capabilities": [
            {"feature": "Searchable PDF", "supported": False},
            {"feature": "Plain text", "supported": True},
            {"feature": "Tables", "supported": True},
            {"feature": "Markdown", "supported": True},
            {"feature": "JSON fields", "supported": False},
            {"feature": "Layout analysis", "supported": True},
            {"feature": "Image captions", "supported": False},
        ],
        "limits": "Needs a GPU for good speed. Does not produce a searchable PDF.",
    },
    {
        "id": "docling",
        "capability": "ocr",
        "name": "Docling",
        "description": "Layout + table recovery → Markdown/JSON. Runs on CPU (slow) or GPU.",
        "runtime": "python-torch",
        "availability": "pack",
        "requirements": {"min_ram_gb": 4, "recommends_gpu": True, "disk_mb": 2500},
        "license": "MIT (model licenses vary)",
        "outputs": ["markdown", "json", "text"],
        "capabilities": [
            {"feature": "Searchable PDF", "supported": False},
            {"feature": "Plain text", "supported": True},
            {"feature": "Tables", "supported": True},
            {"feature": "Markdown", "supported": True},
            {"feature": "JSON fields", "supported": True},
            {"feature": "Layout analysis", "supported": True},
            {"feature": "Image captions", "supported": False},
        ],
        "limits": "Heavy (PyTorch); slow on CPU. No searchable-PDF output.",
    },
    {
        "id": "dolphin",
        "capability": "ocr",
        "name": "Dolphin",
        "description": "ByteDance analyze-then-parse model for complex layouts. GPU recommended.",
        "runtime": "python-torch",
        "availability": "pack",
        "requirements": {"min_ram_gb": 6, "recommends_gpu": True, "disk_mb": 2500},
        "license": "MIT",
        "outputs": ["markdown", "json", "text"],
        "capabilities": [
            {"feature": "Searchable PDF", "supported": False},
            {"feature": "Plain text", "supported": True},
            {"feature": "Tables", "supported": True},
            {"feature": "Markdown", "supported": True},
            {"feature": "JSON fields", "supported": True},
            {"feature": "Layout analysis", "supported": True},
            {"feature": "Image captions", "supported": False},
        ],
        "limits": "GPU strongly recommended; large download.",
    },
]


def _evaluate(engine: dict, profile: dict, ocr_available: bool) -> dict:
    avail_gb = profile.get("ram_available_bytes", 0) / compat.GB
    total_gb = profile.get("ram_total_bytes", 0) / compat.GB
    has_gpu = bool(profile.get("gpu"))
    req = engine["requirements"]

    if engine["runtime"] == "tesseract":
        if ocr_available:
            status = "available"
            verdict = {"level": compat.COMFORTABLE, "reason": "Runs on CPU with minimal memory."}
        else:
            status = "needs-install"
            verdict = {"level": compat.NOT_RECOMMENDED, "reason": "Tesseract not found."}
    else:
        status = "planned"
        verdict = compat.classify(req["min_ram_gb"], avail_gb, total_gb)
        if req.get("recommends_gpu") and not has_gpu and verdict["level"] == compat.COMFORTABLE:
            verdict = {"level": compat.LAG, "reason": "Best with a GPU; slow on CPU only."}

    return {**engine, "status": status, "verdict": verdict}


def evaluate(profile: dict, ocr_available: bool) -> dict:
    """Return capabilities and their engines, each with a per-machine verdict."""
    engines = [_evaluate(e, profile, ocr_available) for e in ENGINES]
    return {"capabilities": CAPABILITIES, "engines": engines}


def engines_for(capability: str) -> list[dict]:
    return [e for e in ENGINES if e["capability"] == capability]
