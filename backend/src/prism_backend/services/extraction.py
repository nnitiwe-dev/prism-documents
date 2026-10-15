"""Text extraction built on pdfplumber (MIT-licensed)."""

from __future__ import annotations

import pdfplumber

from ._common import normalize_pages, require_pdf


def extract_text(input: str, pages: list[int] | None = None) -> dict:
    p = require_pdf(input)
    results: list[dict] = []
    with pdfplumber.open(str(p)) as pdf:
        total = len(pdf.pages)
        targets = normalize_pages(pages, total) if pages else set(range(total))
        for i, page in enumerate(pdf.pages):
            if i in targets:
                results.append({"page": i + 1, "text": page.extract_text() or ""})
    return {"pages": results}
