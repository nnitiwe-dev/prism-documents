"""Docling OCR/parse engine: layout + table aware conversion to Markdown/JSON/text.

Docling (MIT) is the higher-accuracy default when installed; Tesseract is the
lightweight always-available fallback. Docling pulls PyTorch and downloads its
layout/table models on first use, so it is an optional extra, not a base dep.
The converter is built lazily and cached (model load is expensive).
"""

from __future__ import annotations

import json
import platform
import sys

from ._common import PdfOpError, require_pdf

_converter = None


def is_frozen() -> bool:
    """True inside a PyInstaller-packaged build (no pip/uv to install into)."""
    return bool(getattr(sys, "frozen", False))


def supported_platform() -> bool:
    """Docling needs torch >= 2.4, which has no macOS x86_64 (Intel) wheels."""
    return not (platform.system() == "Darwin" and platform.machine() == "x86_64")


def docling_available() -> bool:
    """True only when Docling can actually run.

    Docling's transformers backend needs torch >= 2.4, which has no macOS x86_64
    (Intel) wheels — Intel Macs are capped at torch 2.2.2. So "docling imports"
    is not enough; we require a usable torch.
    """
    try:
        import docling  # noqa: F401
        import torch

        major_minor = tuple(int(x) for x in torch.__version__.split(".")[:2])
        return major_minor >= (2, 4)
    except Exception:
        return False


def _get_converter():
    global _converter
    if _converter is None:
        from docling.document_converter import DocumentConverter

        _converter = DocumentConverter()
    return _converter


def run_docling(input: str, output: str | None, output_format: str = "markdown") -> dict:
    p = require_pdf(input)
    if not docling_available():
        raise PdfOpError("Docling isn't installed. Use Tesseract, or install the Docling engine.")

    try:
        doc = _get_converter().convert(str(p)).document
    except Exception as exc:  # noqa: BLE001
        raise PdfOpError(f"Docling conversion failed: {exc}") from exc

    if output_format == "markdown":
        content = doc.export_to_markdown()
    elif output_format == "json":
        content = json.dumps(doc.export_to_dict(), indent=2, ensure_ascii=False)
    elif output_format == "text":
        try:
            content = doc.export_to_text()
        except Exception:
            content = doc.export_to_markdown()
    else:
        raise PdfOpError(f"Docling can't produce {output_format}.")

    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(content)
    return {"output": output or None, "text": content, "format": output_format}
