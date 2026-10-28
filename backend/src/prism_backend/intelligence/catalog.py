"""Curated catalog of local open-weight models (GGUF) and per-machine verdicts.

A tight, tested set to start. Each entry carries the architecture fields needed
for the KV-cache memory estimate. See docs/intelligence-and-models.md.
"""

from __future__ import annotations

from . import compat

# context used for the memory verdict (summarize/Q&A don't need huge context).
VERDICT_CONTEXT = 4096

MODELS: list[dict] = [
    {
        "id": "smollm2-135m",
        "name": "SmolLM2 135M Instruct",
        "category": "general",
        "params_billion": 0.135,
        "quant": "q4_k_m",
        "context": 8192,
        "size_bytes": 105454144,
        "license": "Apache-2.0",
        "arch": {"layers": 30, "kv_heads": 3, "head_dim": 64},
        "url": "https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q4_K_M.gguf",
        "filename": "SmolLM2-135M-Instruct-Q4_K_M.gguf",
        "note": "Tiny and fast; good for quick tests. Limited quality.",
    },
    {
        "id": "smollm2-360m",
        "name": "SmolLM2 360M Instruct",
        "category": "general",
        "params_billion": 0.36,
        "quant": "q4_k_m",
        "context": 8192,
        "size_bytes": 270590880,
        "license": "Apache-2.0",
        "arch": {"layers": 32, "kv_heads": 5, "head_dim": 64},
        "url": "https://huggingface.co/bartowski/SmolLM2-360M-Instruct-GGUF/resolve/main/SmolLM2-360M-Instruct-Q4_K_M.gguf",
        "filename": "SmolLM2-360M-Instruct-Q4_K_M.gguf",
        "note": "Small and quick; light summaries.",
    },
    {
        "id": "qwen2.5-0.5b",
        "name": "Qwen2.5 0.5B Instruct",
        "category": "summarize",
        "params_billion": 0.5,
        "quant": "q4_k_m",
        "context": 32768,
        "size_bytes": 491400032,
        "license": "Apache-2.0",
        "arch": {"layers": 24, "kv_heads": 2, "head_dim": 64},
        "url": "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
        "filename": "qwen2.5-0.5b-instruct-q4_k_m.gguf",
        "note": "Good balance of size and quality for summaries.",
    },
    {
        "id": "qwen2.5-1.5b",
        "name": "Qwen2.5 1.5B Instruct",
        "category": "summarize",
        "params_billion": 1.5,
        "quant": "q4_k_m",
        "context": 32768,
        "size_bytes": 986048768,
        "license": "Apache-2.0",
        "arch": {"layers": 28, "kv_heads": 2, "head_dim": 128},
        "url": "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
        "filename": "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
        "note": "Noticeably better summaries; needs a bit more memory.",
    },
    {
        "id": "llama-3.2-3b",
        "name": "Llama 3.2 3B Instruct",
        "category": "summarize",
        "params_billion": 3.0,
        "quant": "q4_k_m",
        "context": 131072,
        "size_bytes": 2019377696,
        "license": "Llama 3.2 Community License",
        "arch": {"layers": 28, "kv_heads": 8, "head_dim": 128},
        "url": "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
        "filename": "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
        "note": "Strongest option here; best on a machine with ample RAM or a GPU.",
    },
]

_BY_ID = {m["id"]: m for m in MODELS}


def get(model_id: str) -> dict | None:
    return _BY_ID.get(model_id)


def with_verdicts(profile: dict) -> list[dict]:
    avail_gb = profile.get("ram_available_bytes", 0) / compat.GB
    total_gb = profile.get("ram_total_bytes", 0) / compat.GB
    out = []
    for m in MODELS:
        est = compat.estimate_model_memory_gb(
            m["params_billion"], m["quant"],
            layers=m["arch"]["layers"], kv_heads=m["arch"]["kv_heads"],
            head_dim=m["arch"]["head_dim"], context=VERDICT_CONTEXT,
        )
        verdict = compat.classify(est["total_gb"], avail_gb, total_gb)
        out.append({**m, "estimate": est, "verdict": verdict})
    return out
