"""Shared helpers for the services layer."""

from __future__ import annotations

from pathlib import Path

from pypdf import PdfWriter


class PdfOpError(ValueError):
    """Raised for invalid input; mapped to HTTP 400 by the routers."""


def require_pdf(path: str) -> Path:
    p = Path(path).expanduser()
    if not p.is_file():
        raise PdfOpError(f"file not found: {path}")
    if p.suffix.lower() != ".pdf":
        raise PdfOpError(f"input must be a .pdf file: {path}")
    return p


def normalize_pages(pages: list[int], total: int) -> set[int]:
    """Convert 1-indexed page numbers to a validated set of 0-indexed indices."""
    out: set[int] = set()
    for pg in pages:
        if pg < 1 or pg > total:
            raise PdfOpError(f"page {pg} out of range (1..{total})")
        out.add(pg - 1)
    return out


def write_pdf(writer: PdfWriter, output: str) -> Path:
    out = Path(output).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "wb") as f:
        writer.write(f)
    return out
