"""Hardware/model compatibility math and verdict classification.

Pure functions (no I/O) so they are fully unit-testable. The memory model is the
community-standard estimate for llama.cpp/GGUF, to be refined later by a real
benchmark and verified against the load log. See docs/intelligence-and-models.md.
"""

from __future__ import annotations

GB = 1024**3

# Approximate bytes per parameter by GGUF quantization level.
BYTES_PER_PARAM = {
    "q4_k_m": 0.55,
    "q5_k_m": 0.67,
    "q6_k": 0.82,
    "q8_0": 1.0,
    "f16": 2.0,
    "f32": 4.0,
}

# Verdict levels.
COMFORTABLE = "comfortable"
LAG = "lag"
NOT_RECOMMENDED = "not-recommended"


def estimate_weights_gb(params_billion: float, quant: str) -> float:
    bpp = BYTES_PER_PARAM.get(quant.lower(), 1.0)
    return params_billion * 1e9 * bpp / GB


def estimate_kv_cache_gb(
    layers: int, kv_heads: int, head_dim: int, context: int, bytes_per_elem: int = 2, batch: int = 1
) -> float:
    return (2 * layers * kv_heads * head_dim * context * bytes_per_elem * batch) / GB


def estimate_model_memory_gb(
    params_billion: float,
    quant: str,
    *,
    layers: int = 32,
    kv_heads: int = 8,
    head_dim: int = 128,
    context: int = 4096,
    overhead: float = 0.2,
    base_gb: float = 0.8,
) -> dict:
    """Return a breakdown of estimated memory to run a model."""
    weights = estimate_weights_gb(params_billion, quant)
    kv = estimate_kv_cache_gb(layers, kv_heads, head_dim, context)
    runtime = (weights + kv) * overhead + base_gb
    total = weights + kv + runtime
    return {
        "weights_gb": round(weights, 2),
        "kv_cache_gb": round(kv, 2),
        "runtime_gb": round(runtime, 2),
        "total_gb": round(total, 2),
    }


def classify(
    required_gb: float, available_gb: float, total_gb: float, headroom_gb: float = 2.5
) -> dict:
    """Classify a memory requirement against this machine.

    - comfortable: fits in currently-available RAM with headroom.
    - lag: fits in total RAM but would squeeze what other apps need.
    - not-recommended: exceeds total RAM.
    """
    if required_gb + headroom_gb <= available_gb:
        return {"level": COMFORTABLE, "reason": "Fits in available memory with headroom."}
    if required_gb + headroom_gb <= total_gb:
        return {"level": LAG, "reason": "Fits only by squeezing memory other apps need."}
    return {
        "level": NOT_RECOMMENDED,
        "reason": f"Needs about {required_gb:.1f} GB; this machine has {total_gb:.1f} GB total.",
    }
