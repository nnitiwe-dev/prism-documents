"""Non-destructive PDF page operations built on pypdf (BSD-licensed).

Every operation reads an input PDF and writes a new output file; inputs are never
modified in place.
"""

from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader, PdfWriter

from ._common import PdfOpError, normalize_pages, require_pdf, write_pdf


def get_info(path: str) -> dict:
    p = require_pdf(path)
    reader = PdfReader(str(p))
    encrypted = reader.is_encrypted
    if encrypted:
        try:
            reader.decrypt("")
            encrypted = False
        except Exception:
            pass
    try:
        pages = len(reader.pages)
    except Exception:
        pages = 0
    meta = reader.metadata or {}
    try:
        size_bytes = p.stat().st_size
    except OSError:
        size_bytes = 0
    return {
        "path": str(p),
        "pages": pages,
        "encrypted": encrypted,
        "size_bytes": size_bytes,
        "title": getattr(meta, "title", None),
        "author": getattr(meta, "author", None),
    }


def merge(inputs: list[str], output: str) -> dict:
    writer = PdfWriter()
    for inp in inputs:
        require_pdf(inp)
        writer.append(inp)
    out = write_pdf(writer, output)
    return {"output": str(out), "pages": len(writer.pages)}


def rotate(input: str, output: str, rotation: int, pages: list[int] | None = None) -> dict:
    if rotation % 90 != 0:
        raise PdfOpError("rotation must be a multiple of 90")
    reader = PdfReader(str(require_pdf(input)))
    total = len(reader.pages)
    targets = normalize_pages(pages, total) if pages else set(range(total))
    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if i in targets:
            page.rotate(rotation)
        writer.add_page(page)
    out = write_pdf(writer, output)
    return {"output": str(out), "pages": len(writer.pages)}


def delete_pages(input: str, output: str, pages: list[int]) -> dict:
    reader = PdfReader(str(require_pdf(input)))
    total = len(reader.pages)
    remove = normalize_pages(pages, total)
    if len(remove) >= total:
        raise PdfOpError("cannot delete every page")
    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if i not in remove:
            writer.add_page(page)
    out = write_pdf(writer, output)
    return {"output": str(out), "pages": len(writer.pages)}


def reorder(input: str, output: str, order: list[int]) -> dict:
    reader = PdfReader(str(require_pdf(input)))
    total = len(reader.pages)
    indices = [n - 1 for n in order]
    if sorted(indices) != list(range(total)):
        raise PdfOpError("order must be a permutation of all pages (1..N)")
    writer = PdfWriter()
    for i in indices:
        writer.add_page(reader.pages[i])
    out = write_pdf(writer, output)
    return {"output": str(out), "pages": len(writer.pages)}


def split(input: str, output_dir: str, ranges: list[dict] | None = None) -> dict:
    p = require_pdf(input)
    reader = PdfReader(str(p))
    total = len(reader.pages)
    out_dir = Path(output_dir).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = p.stem
    outputs: list[str] = []

    if ranges:
        for r in ranges:
            start, end = r["start"], r["end"]
            if start > end:
                raise PdfOpError(f"range start {start} is after end {end}")
            if start < 1 or end > total:
                raise PdfOpError(f"range {start}-{end} out of bounds (1..{total})")
            writer = PdfWriter()
            writer.append(str(p), pages=(start - 1, end))  # stop-exclusive slice
            name = r.get("name") or f"{stem}_{start}-{end}.pdf"
            if not name.lower().endswith(".pdf"):
                name += ".pdf"
            dest = write_pdf(writer, str(out_dir / name))
            outputs.append(str(dest))
    else:
        for i in range(total):
            writer = PdfWriter()
            writer.append(str(p), pages=(i, i + 1))
            dest = write_pdf(writer, str(out_dir / f"{stem}_p{i + 1}.pdf"))
            outputs.append(str(dest))

    return {"outputs": outputs}
