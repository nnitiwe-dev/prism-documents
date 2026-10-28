"""OCR endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..schemas import OcrIn, OcrResult
from ..security import verify_token
from ..services import docling_engine, extraction, ocr
from ..services._common import PdfOpError

router = APIRouter(prefix="/ocr", dependencies=[Depends(verify_token)])


@router.get("/languages")
async def languages() -> dict:
    return {"available": ocr.tesseract_available(), "languages": ocr.ocr_languages()}


@router.post("/run", response_model=OcrResult)
async def run(body: OcrIn):
    try:
        if body.engine == "text-layer":
            return extraction.extract_formatted(body.input, body.output_format, body.output)
        if body.engine == "tesseract":
            return ocr.run_ocr(
                body.input, body.output, language=body.language, force=body.force,
                output_format=body.output_format,
            )
        if body.engine == "docling":
            return docling_engine.run_docling(
                body.input, body.output, output_format=body.output_format
            )
        raise HTTPException(status_code=400, detail=f"Engine '{body.engine}' is not available yet.")
    except PdfOpError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc
