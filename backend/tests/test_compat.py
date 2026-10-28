from __future__ import annotations

from prism_backend.intelligence import compat


def test_weights_scale_with_quant():
    q4 = compat.estimate_weights_gb(8, "q4_k_m")
    q8 = compat.estimate_weights_gb(8, "q8_0")
    assert q8 > q4 > 0


def test_kv_cache_grows_with_context():
    small = compat.estimate_kv_cache_gb(32, 8, 128, 4096)
    big = compat.estimate_kv_cache_gb(32, 8, 128, 32768)
    assert big > small > 0


def test_estimate_breakdown():
    m = compat.estimate_model_memory_gb(8, "q4_k_m")
    assert {"weights_gb", "kv_cache_gb", "runtime_gb", "total_gb"} <= m.keys()
    assert m["total_gb"] >= m["weights_gb"]


def test_classify_levels():
    assert compat.classify(2, 16, 32)["level"] == compat.COMFORTABLE
    assert compat.classify(20, 4, 24)["level"] == compat.LAG
    assert compat.classify(40, 4, 16)["level"] == compat.NOT_RECOMMENDED
