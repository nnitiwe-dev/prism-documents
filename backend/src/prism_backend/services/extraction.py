"""Text extraction built on pdfplumber (MIT-licensed)."""

from __future__ import annotations

import json

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


def extract_formatted(input: str, output_format: str = "text", output: str | None = None) -> dict:
    """Extract the PDF's text layer as plain text or per-page JSON."""
    res = extract_text(input)
    if output_format == "json":
        content = json.dumps({"pages": res["pages"]}, indent=2, ensure_ascii=False)
    else:
        content = "\n\n".join(p["text"] for p in res["pages"]).strip()
    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(content)
    return {"output": output or None, "text": content, "format": output_format}
