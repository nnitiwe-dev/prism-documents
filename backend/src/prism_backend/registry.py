"""The capability registry: the single source of truth for tools.

The Electron home carousel, the full tools gallery, the category filter, and the
command palette are all rendered from this list. Adding a tool here makes it
appear in every surface. ``execution`` says where a tool runs: ``client`` tools
are handled entirely in the renderer (e.g. PDF.js viewing), ``backend`` tools
call an endpoint below.
"""

from __future__ import annotations

from . import __version__

CATEGORIES: list[dict] = [
    {"id": "organize-edit", "label": "Organize & edit"},
    {"id": "annotate", "label": "Annotate"},
    {"id": "forms-signing", "label": "Forms & signing"},
    {"id": "convert-export", "label": "Convert & export"},
    {"id": "content-understanding", "label": "Content understanding"},
    {"id": "extraction", "label": "Extraction"},
    {"id": "security", "label": "Security"},
    {"id": "optimize", "label": "Optimize"},
]

# status: "ready" (shipped & tested) | "beta" (works, rough edges) | "planned"
TOOLS: list[dict] = [
    {
        "id": "view",
        "name": "Open & view",
        "description": "Open, read, search, zoom, and navigate a PDF.",
        "category": "organize-edit",
        "icon": "ti-file-text",
        "execution": "client",
        "status": "ready",
    },
    {
        "id": "merge",
        "name": "Merge PDFs",
        "description": "Combine several PDFs into one document.",
        "category": "organize-edit",
        "icon": "ti-files",
        "execution": "backend",
        "endpoint": "/pdf/merge",
        "status": "ready",
    },
    {
        "id": "split",
        "name": "Split PDF",
        "description": "Split a PDF into page ranges or one file per page.",
        "category": "organize-edit",
        "icon": "ti-scissors",
        "execution": "backend",
        "endpoint": "/pdf/split",
        "status": "ready",
    },
    {
        "id": "remove-pages",
        "name": "Remove pages",
        "description": "Delete one or more pages from a PDF.",
        "category": "organize-edit",
        "icon": "ti-file-minus",
        "execution": "backend",
        "endpoint": "/pdf/delete-pages",
        "status": "ready",
    },
    {
        "id": "reorder",
        "name": "Reorder pages",
        "description": "Rearrange the pages of a PDF.",
        "category": "organize-edit",
        "icon": "ti-arrows-sort",
        "execution": "backend",
        "endpoint": "/pdf/reorder",
        "status": "ready",
    },
    {
        "id": "rotate",
        "name": "Rotate pages",
        "description": "Rotate selected pages by 90, 180, or 270 degrees.",
        "category": "organize-edit",
        "icon": "ti-rotate-clockwise",
        "execution": "backend",
        "endpoint": "/pdf/rotate",
        "status": "ready",
    },
    {
        "id": "extract-text",
        "name": "Extract text",
        "description": "Pull selectable text out of a PDF, page by page.",
        "category": "extraction",
        "icon": "ti-text-recognition",
        "execution": "backend",
        "endpoint": "/pdf/extract-text",
        "status": "ready",
    },
    {
        "id": "annotate",
        "name": "Highlight & notes",
        "description": "Highlight, underline, draw, and add notes.",
        "category": "annotate",
        "icon": "ti-highlight",
        "execution": "client",
        "status": "planned",
    },
    {
        "id": "fill-form",
        "name": "Fill form",
        "description": "Fill standard (AcroForm) PDF form fields.",
        "category": "forms-signing",
        "icon": "ti-forms",
        "execution": "backend",
        "endpoint": "/pdf/fill-form",
        "status": "planned",
    },
    {
        "id": "sign",
        "name": "Sign",
        "description": "Add a visible signature image or drawing.",
        "category": "forms-signing",
        "icon": "ti-signature",
        "execution": "client",
        "status": "planned",
    },
    {
        "id": "ocr",
        "name": "OCR scan",
        "description": "Make a scanned PDF searchable (selectable text).",
        "category": "extraction",
        "icon": "ti-scan",
        "execution": "backend",
        "endpoint": "/ocr/run",
        "status": "ready",
    },
]


def capabilities() -> dict:
    return {"version": __version__, "categories": CATEGORIES, "tools": TOOLS}
