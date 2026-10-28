"""OCR via the Tesseract engine (wheel-only stack).

Produces a searchable PDF: pages that already contain text are kept as-is
(lossless); pages without text are rasterized with pypdfium2 and run through
Tesseract's own PDF renderer (via pytesseract), which emits a single-page PDF
with the image plus an invisible, selectable text layer.

Requires only the system ``tesseract`` binary — no ghostscript/qpdf — so it
installs from wheels and is straightforward to bundle per platform.
"""

from __future__ import annotations

import io
import shutil
import subprocess

from pypdf import PdfReader, PdfWriter

from ._common import PdfOpError, require_pdf

RENDER_DPI = 300


def tesseract_available() -> bool:
    return shutil.which("tesseract") is not None


def ocr_languages() -> list[str]:
    """Installed Tesseract language codes (e.g. ['eng', 'deu'])."""
    if not shutil.which("tesseract"):
        return []
    try:
        out = subprocess.run(
            ["tesseract", "--list-langs"], capture_output=True, text=True, timeout=10, check=False
        )
        lines = out.stdout.splitlines()[1:]  # first line is a header
        return sorted(ln.strip() for ln in lines if ln.strip() and "osd" not in ln)
    except Exception:
        return []


def _page_has_text(page) -> bool:
    try:
        return bool((page.extract_text() or "").strip())
    except Exception:
        return False


def run_ocr(
    input: str,
    output: str,
    language: str = "eng",
    force: bool = False,
    output_format: str = "searchable-pdf",
) -> dict:
    p = require_pdf(input)
    if not tesseract_available():
        raise PdfOpError("OCR engine not available: install tesseract.")
    try:
        import pypdfium2 as pdfium
        import pytesseract
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise PdfOpError("OCR support is not installed (pytesseract/pypdfium2).") from exc

    if output_format == "searchable-pdf":
        return _searchable_pdf(p, output, language, force, pdfium, pytesseract)
    if output_format == "text":
        return _plain_text(p, output, language, force, pdfium, pytesseract)
    raise PdfOpError(
        f"Tesseract can't produce {output_format}. For Markdown/JSON use Docling (coming soon)."
    )


def _searchable_pdf(p, output, language, force, pdfium, pytesseract) -> dict:
    reader = PdfReader(str(p))
    writer = PdfWriter()
    pdfium_doc = pdfium.PdfDocument(str(p))
    ocr_pages = 0
    try:
        for i in range(len(reader.pages)):
            if not force and _page_has_text(reader.pages[i]):
                writer.add_page(reader.pages[i])  # keep native text page, lossless
                continue
            bitmap = pdfium_doc[i].render(scale=RENDER_DPI / 72)
            pil = bitmap.to_pil()
            try:
                page_pdf = pytesseract.image_to_pdf_or_hocr(pil, lang=language, extension="pdf")
            except Exception as exc:  # noqa: BLE001
                raise PdfOpError(f"OCR failed on page {i + 1}: {exc}") from exc
            writer.append(io.BytesIO(page_pdf))
            ocr_pages += 1
    finally:
        pdfium_doc.close()
    with open(output, "wb") as f:
        writer.write(f)
    return {
        "output": output,
        "format": "searchable-pdf",
        "language": language,
        "pages_ocred": ocr_pages,
    }


def _plain_text(p, output, language, force, pdfium, pytesseract) -> dict:
    reader = PdfReader(str(p))
    pdfium_doc = pdfium.PdfDocument(str(p))
    parts: list[str] = []
    ocr_pages = 0
    try:
        for i in range(len(reader.pages)):
            if not force and _page_has_text(reader.pages[i]):
                parts.append(reader.pages[i].extract_text() or "")
                continue
            bitmap = pdfium_doc[i].render(scale=RENDER_DPI / 72)
            parts.append(pytesseract.image_to_string(bitmap.to_pil(), lang=language))
            ocr_pages += 1
    finally:
        pdfium_doc.close()
    text = "\n\n".join(parts).strip()
    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(text)
    return {
        "output": output or None, "text": text, "format": "text",
        "language": language, "pages_ocred": ocr_pages,
    }
