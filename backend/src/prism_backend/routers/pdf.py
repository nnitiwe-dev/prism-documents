"""PDF operation endpoints. All paths are local filesystem paths.

Because the backend and shell run on the same machine, operations pass file
paths rather than streaming bytes over HTTP — this avoids copying large PDFs and
keeps memory use low.
"""

from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException

from ..schemas import (
    DeletePagesIn,
    ExtractResult,
    ExtractTextIn,
    MergeIn,
    OpResult,
    PathIn,
    PdfInfo,
    ReorderIn,
    RotateIn,
    SplitIn,
    SplitResult,
)
from ..security import verify_token
from ..services import extraction, pdf_ops
from ..services._common import PdfOpError

router = APIRouter(prefix="/pdf", dependencies=[Depends(verify_token)])


def _run(fn: Callable, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except PdfOpError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - surface a clean 500 to the shell
        raise HTTPException(status_code=500, detail=f"PDF operation failed: {exc}") from exc


@router.post("/info", response_model=PdfInfo)
async def info(body: PathIn):
    return _run(pdf_ops.get_info, body.path)


@router.post("/merge", response_model=OpResult)
async def merge(body: MergeIn):
    return _run(pdf_ops.merge, body.inputs, body.output)


@router.post("/split", response_model=SplitResult)
async def split(body: SplitIn):
    ranges = [r.model_dump() for r in body.ranges] if body.ranges else None
    return _run(pdf_ops.split, body.input, body.output_dir, ranges)


@router.post("/rotate", response_model=OpResult)
async def rotate(body: RotateIn):
    return _run(pdf_ops.rotate, body.input, body.output, body.rotation, body.pages)


@router.post("/delete-pages", response_model=OpResult)
async def delete_pages(body: DeletePagesIn):
    return _run(pdf_ops.delete_pages, body.input, body.output, body.pages)


@router.post("/reorder", response_model=OpResult)
async def reorder(body: ReorderIn):
    return _run(pdf_ops.reorder, body.input, body.output, body.order)


@router.post("/extract-text", response_model=ExtractResult)
async def extract_text(body: ExtractTextIn):
    return _run(extraction.extract_text, body.input, body.pages)
