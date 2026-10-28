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
    {"id": "ocr", "label": "Text extraction & OCR"},
    {"id": "extraction", "label": "Structured extraction"},
    {"id": "summarize", "label": "Summarize & Q&A"},
]

# availability: "bundled" (ships / uses a system tool) | "pack" (on-demand download)
# status is derived at runtime (available / needs-install / planned).
ENGINES: list[dict] = [
    {
        "id": "text-layer",
        "capability": "ocr",
        "name": "Text layer (fast)",
        "description": "Reads text already embedded in a PDF — instant and exact. Not for scans.",
        "runtime": "pdfplumber",
        "availability": "bundled",
        "requirements": {"min_ram_gb": 0.2, "recommends_gpu": False, "disk_mb": 0},
        "license": "MIT",
        "outputs": ["text", "json"],
        "capabilities": [
            {"feature": "Searchable PDF", "supported": False},
            {"feature": "Plain text", "supported": True},
            {"feature": "Tables", "supported": False},
            {"feature": "Markdown", "supported": False},
            {"feature": "JSON fields", "supported": True},
            {"feature": "Layout analysis", "supported": False},
            {"feature": "Image captions", "supported": False},
        ],
        "limits": "Only reads existing text. Scans (image-only pages) need an OCR engine.",
        "default": True,
    },
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
        "fallback": True,
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
        "limits": "Heavy (PyTorch); slow on CPU. First run downloads models. No searchable PDF.",
        "recommended_ocr": True,
    },
]


def _evaluate(
    engine: dict,
    profile: dict,
    ocr_available: bool,
    docling_available: bool,
    docling_supported: bool = True,
) -> dict:
    avail_gb = profile.get("ram_available_bytes", 0) / compat.GB
    total_gb = profile.get("ram_total_bytes", 0) / compat.GB
    has_gpu = bool(profile.get("gpu"))
    req = engine["requirements"]

    if engine["runtime"] == "pdfplumber":
        return {
            **engine,
            "status": "available",
            "installable": False,
            "verdict": {"level": compat.COMFORTABLE, "reason": "Reads the text layer instantly."},
        }

    if engine["id"] == "docling":
        verdict = compat.classify(req["min_ram_gb"], avail_gb, total_gb)
        if req.get("recommends_gpu") and not has_gpu and verdict["level"] == compat.COMFORTABLE:
            verdict = {"level": compat.LAG, "reason": "Runs on CPU; slower without a GPU."}
        if docling_available:
            status = "available"
        elif not docling_supported:
            status = "unsupported"
            verdict = {"level": compat.NOT_RECOMMENDED, "reason": "Not supported on this platform (needs PyTorch >= 2.4)."}  # noqa: E501
        else:
            status = "needs-install"
        return {
            **engine,
            "status": status,
            "installable": status == "needs-install",
            "removable": docling_available,
            "force_installable": status == "unsupported",
            "verdict": verdict,
        }

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

    return {**engine, "status": status, "installable": False, "verdict": verdict}


def evaluate(
    profile: dict,
    ocr_available: bool,
    docling_available: bool = False,
    docling_supported: bool = True,
) -> dict:
    """Return capabilities and their engines, each with a per-machine verdict."""
    engines = [
        _evaluate(e, profile, ocr_available, docling_available, docling_supported) for e in ENGINES
    ]
    return {"capabilities": CAPABILITIES, "engines": engines}


def engines_for(capability: str) -> list[dict]:
    return [e for e in ENGINES if e["capability"] == capability]
