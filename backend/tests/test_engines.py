from __future__ import annotations

from prism_backend.intelligence import engines
from prism_backend.services import ocr

PROFILE = {"ram_total_bytes": 16 * 1024**3, "ram_available_bytes": 8 * 1024**3, "gpu": None}


def test_evaluate_includes_ocr_engines():
    out = engines.evaluate(PROFILE, ocr_available=True)
    ids = [e["id"] for e in out["engines"]]
    assert "tesseract" in ids
    assert any(c["id"] == "ocr" for c in out["capabilities"])


def test_tesseract_available_verdict():
    out = engines.evaluate(PROFILE, ocr_available=True)
    tess = next(e for e in out["engines"] if e["id"] == "tesseract")
    assert tess["status"] == "available"
    assert tess["verdict"]["level"] == "comfortable"


def test_tesseract_needs_install_when_absent():
    out = engines.evaluate(PROFILE, ocr_available=False)
    tess = next(e for e in out["engines"] if e["id"] == "tesseract")
    assert tess["status"] == "needs-install"


def test_pack_engines_are_planned_with_verdict():
    out = engines.evaluate(PROFILE, ocr_available=True)
    doc = next(e for e in out["engines"] if e["id"] == "docling")
    assert doc["status"] == "planned"
    assert "level" in doc["verdict"]


def test_ocr_service_probes_are_typed():
    assert isinstance(ocr.tesseract_available(), bool)
    assert isinstance(ocr.ocr_languages(), list)
