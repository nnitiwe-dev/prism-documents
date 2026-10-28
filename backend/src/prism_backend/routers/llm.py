"""Model catalog, downloads, and LLM capability endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..intelligence import catalog
from ..schemas import ModelActionIn, SummarizeIn, SummarizeResult
from ..security import verify_token
from ..services import hardware, llm, models_mgr
from ..services._common import PdfOpError

router = APIRouter(dependencies=[Depends(verify_token)])


@router.get("/models")
async def models() -> dict:
    """Catalog with per-machine verdicts merged with install/download status."""
    rows = catalog.with_verdicts(hardware.profile())
    st = {r["id"]: r for r in models_mgr.status()["models"]}
    merged = [{**m, **st.get(m["id"], {})} for m in rows]
    return {"models": merged, "llm_available": llm.llm_available()}


@router.get("/models/status")
async def models_status() -> dict:
    return models_mgr.status()


@router.post("/models/download")
async def download(body: ModelActionIn) -> dict:
    try:
        return models_mgr.start_download(body.model_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/models/remove")
async def remove(body: ModelActionIn) -> dict:
    try:
        return models_mgr.remove(body.model_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/llm/summarize", response_model=SummarizeResult)
async def summarize(body: SummarizeIn):
    try:
        return llm.summarize(body.input, body.model_id)
    except PdfOpError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Summarization failed: {exc}") from exc
