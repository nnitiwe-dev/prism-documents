"""Local LLM runtime (llama.cpp via llama-cpp-python) and the summarize capability.

One model is held in memory at a time. Summarization reads the document's
selectable text (OCR first for scans), caps it to the model's context, and asks
the model for a concise summary.
"""

from __future__ import annotations

import os

from ..intelligence import catalog
from . import extraction, models_mgr
from ._common import PdfOpError

_cache: dict = {"id": None, "llm": None}
N_CTX = 4096
MAX_CHARS = 6000


def llm_available() -> bool:
    try:
        import llama_cpp  # noqa: F401
        return True
    except Exception:
        return False


def _ensure_loaded(model: dict):
    if _cache["id"] == model["id"] and _cache["llm"] is not None:
        return _cache["llm"]
    _cache["llm"] = None  # evict the previous model before loading another
    from llama_cpp import Llama

    llm = Llama(
        model_path=str(models_mgr.model_path(model)),
        n_ctx=N_CTX,
        n_threads=os.cpu_count() or 4,
        verbose=False,
    )
    _cache.update(id=model["id"], llm=llm)
    return llm


def summarize(input_pdf: str, model_id: str) -> dict:
    model = catalog.get(model_id)
    if not model:
        raise PdfOpError("Unknown model.")
    if not models_mgr.is_installed(model):
        raise PdfOpError("That model isn't downloaded yet.")

    pages = extraction.extract_text(input_pdf)["pages"]
    text = "\n".join(p["text"] for p in pages).strip()
    if not text:
        raise PdfOpError("No selectable text found — run OCR first for scanned PDFs.")
    truncated = len(text) > MAX_CHARS
    text = text[:MAX_CHARS]

    llm = _ensure_loaded(model)
    prompt = (
        "Summarize the following document in a few short, clear paragraphs.\n\n"
        f"{text}\n\nSummary:"
    )
    try:
        try:
            out = llm.create_chat_completion(
                messages=[
                    {"role": "system", "content": "You summarize documents clearly and concisely."},
                    {"role": "user", "content": f"Summarize this document:\n\n{text}"},
                ],
                max_tokens=400,
                temperature=0.3,
            )
            summary = out["choices"][0]["message"]["content"].strip()
        except Exception:
            # Fall back to a plain completion if the model has no chat template.
            out = llm(prompt, max_tokens=400, temperature=0.3)
            summary = out["choices"][0]["text"].strip()
    except Exception as exc:  # noqa: BLE001
        raise PdfOpError(f"Summarization failed: {exc}") from exc

    return {"summary": summary, "model": model["name"], "truncated": truncated}
