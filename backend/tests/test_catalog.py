from __future__ import annotations

from prism_backend.intelligence import catalog

PROFILE = {"ram_total_bytes": 16 * 1024**3, "ram_available_bytes": 8 * 1024**3, "gpu": None}


def test_catalog_ids_unique():
    ids = [m["id"] for m in catalog.MODELS]
    assert len(ids) == len(set(ids))


def test_with_verdicts_shape():
    rows = catalog.with_verdicts(PROFILE)
    assert rows
    for r in rows:
        assert "verdict" in r and "level" in r["verdict"]
        assert "estimate" in r and r["estimate"]["total_gb"] > 0


def test_get_known_model():
    m = catalog.get("smollm2-135m")
    assert m and m["params_billion"] == 0.135
    assert catalog.get("nope") is None
