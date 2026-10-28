# Intelligence, models & pluggable engines — architecture plan

Status: **proposal / design** (not yet built). This is the foundation the AI
features (OCR, extraction, summarization, Q&A, …) build on. It covers the model
recommendation engine, the hardware assessment, the pluggable-engine framework,
and the UX/UI. Reviewed against current (2026) tooling — sources at the end.

---

## 1. Principles

1. **Local-first & optional.** Every AI feature is opt-in and runs on-device by
   default. The PDF tools must keep working with zero models installed.
2. **Capability-first, not chat-first.** PRISM is a document workspace, not a
   chatbot. Models are chosen *for a capability* (OCR, extraction, …), not as
   general chat partners. (A small test/playground is a secondary affordance —
   see §3.)
3. **Honest about the user's PC.** Never let a user unknowingly install a model
   that will freeze their machine. Classify every model/engine for *their*
   hardware: **Runs comfortably / Will lag / Not recommended**.
4. **Permissive licenses only in the curated catalog**, and surface each model's
   own license (model weights often differ from the tool's code license).
5. **Every feature is its own screen** (same pattern as merge/split/remove),
   with its own engine picker and options.

---

## 2. The big question: chat vs feature-only → **capability-first, with an optional test panel**

Recommendation: **do not make this an Ollama-style chat app.** Bind models to
capabilities. Reasons:

- The recommendation engine can only give a meaningful verdict ("can your PC do
  OCR on a 30-page scan?") when it knows the *task*, context length, and engine —
  not just "a model".
- It keeps the UX focused and lets each feature screen show only engines that fit
  that task.
- It avoids the trap of shipping a general assistant we then have to make safe,
  moderate, and support.

But **do** give a lightweight **"Test" panel** per downloaded model (a minimal
prompt/response or "run on a sample page") so users can sanity-check a model and
trust it before relying on it in a feature. That's a diagnostic, not the product.

> Net: the catalogue is organized by **what the model does for your documents**;
> chat is a debugging tool, not the main metaphor.

---

## 3. Layered architecture

```
Feature screens (OCR, Extract fields, Summarize …)  ← each its own tool page
        │   picks an Engine for the capability
        ▼
Capability → Engine registry           (backend: declares engines + requirements)
        │
        ▼
Engine adapters:
   • Tesseract (CPU, bundled)          • llama.cpp runtime (GGUF, bundled)
   • Docling / Dolphin / PaddleOCR     • (optional heavy "engine packs", on-demand)
        │
        ▼
Model + Engine Manager  ──►  Hardware & Compatibility engine  ──►  verdict
        │                         (profiler · memory math · tok/s estimate · benchmark)
        ▼
Downloads (models + engine packs): resumable, checksummed, disk-aware
```

Key idea: a **Capability** (e.g. `ocr`) has several **Engines**, each a small
adapter that declares: runtime (tesseract-binary / llama.cpp / python-torch),
the model(s) it uses, hardware needs, license, inputs/outputs, and whether it is
*bundled* or an *optional download*. Feature screens and the Models section are
both views over this registry — exactly how the PDF tools work today.

---

## 4. Model recommendation engine

Five components (backend services on the existing FastAPI layer):

### 4.1 HardwareProfiler
CPU model + cores, **available** RAM (not just total), GPU vendor/model + VRAM,
Apple unified memory, free disk, and — critically — **which backends the
packaged llama.cpp can actually use** (Metal / CUDA / Vulkan / CPU). Detecting a
GPU ≠ being able to use it; verify the runtime, don't assume from the name.

### 4.2 ModelCatalog
Curated open-weight models with per-variant metadata: params, quant (and
bytes/param), file size, context limit, category, license, source repo, sha256,
and the GGUF architecture fields needed for KV-cache math (layers, kv_heads,
head_dim).

### 4.3 CompatibilityEngine (the estimate)
Memory budget (community-standard formula, verified against the load log):

```
M_required ≈ M_weights + M_kv_cache + M_runtime + M_headroom
M_weights  = params × bytes_per_param     (Q4_K_M≈0.55, Q5_K_M≈0.67, Q8_0≈1.0)
M_kv_cache = 2 × layers × kv_heads × head_dim × context × bytes × batch
M_runtime  ≈ 15–20% of (weights+kv) + ~0.5–1 GB
M_headroom = reserve for the OS + the rest of PRISM (e.g. 2–3 GB)
```

Speed estimate: seed tokens/sec from a **CPU/GPU reference table** (memory
bandwidth is the main predictor for CPU inference), refined by a real short
benchmark (§4.5). Then classify:

- **Runs comfortably** — fits the budget with headroom, backend supported, est.
  ≥ a target tok/s.
- **Will lag** — fits only with compromises (CPU-only, partial GPU offload,
  smaller context, heavier quant) or est. below target tok/s.
- **Not recommended** — exceeds safe memory, or no supported backend. User can
  still force-download with an explicit "this will make your PC slow" warning.

### 4.4 DownloadManager
Resumable chunked downloads, sha256 verification, disk-space precheck, pause/
cancel, background with progress, and clean removal. Handles both **model
weights** and **optional engine packs**.

### 4.5 BenchmarkRunner
A short, **memory-guarded** prompt-processing + generation test producing real
TTFT and tok/s. Abort if available RAM drops below a threshold — a benchmark that
freezes the laptop is worse than an estimate. Cache results per (model, machine).

These map onto the hardware payload already stubbed in
`backend/.../services/hardware.py`.

---

## 5. Engine strategy — the hard part: heavy deps & native runtimes

Two realities shape this:

1. **The best OCR engines need PyTorch** (Docling, Dolphin, PaddleOCR-VL). PyTorch
   is huge (multi-GB, GPU-specific) and must not bloat the base installer.
2. **Native runtimes can't be cross-built** — same lesson as the backend
   (PyInstaller). llama.cpp and tesseract binaries are per-OS.

Proposed tiers:

- **Bundled, lightweight (ship in the app):**
  - **Tesseract** — small C++ OCR, CPU-only, great for clean printed text →
    the *default, always-available* OCR engine.
  - **llama.cpp** runtime (small native binary, per-OS) → runs GGUF LLMs for
    extraction/summarization/Q&A.
- **Optional "engine packs" (downloaded on demand, managed like models):**
  - **Docling**, **Dolphin**, **PaddleOCR-VL**, etc. Installed into an app-managed
    **uv virtual environment** created on first use, *not* bundled. The Model &
    Engine Manager treats an engine pack like a large download with its own
    hardware verdict (these want a GPU; flag "Will lag" on CPU-only machines).

This keeps the base download small, honors licenses (don't redistribute heavy
weights/runtimes), and lets power users opt into VLM-grade quality. The same CI
matrix that builds the backend builds/fetches the per-OS native runtimes.

---

## 6. OCR as the first pluggable capability

Ship OCR first, as the reference implementation of the engine framework.

| Engine | Runtime | Strengths | Hardware | License |
|--------|---------|-----------|----------|---------|
| **Tesseract 5** | bundled, CPU | clean printed text, 100+ langs, light | any | Apache-2.0 |
| **PaddleOCR-VL** | engine pack | mixed scans → Markdown, tables | GPU preferred | Apache-2.0 |
| **Docling** | engine pack | layout + tables + structure → MD/JSON | CPU ok, slow; GPU better | MIT code (model licenses vary) |
| **Dolphin (ByteDance)** | engine pack | analyze-then-parse, complex layouts | GPU | MIT (verify v2) |

UX: the OCR screen has an **engine dropdown**, each option annotated with the
per-user verdict badge; Tesseract is the default so OCR works out of the box.
Choosing a pack that isn't installed triggers a guided download. Output is always
normalized to a common result (text + optional layout/JSON), so downstream
features don't care which engine produced it. The same pattern then serves
"Extract fields (JSON)", "Summarize", "Ask this document", etc.

---

## 7. Model catalogue — categories

Organize the catalogue by capability, not by vendor:

- **OCR / document parsing** — Tesseract, PaddleOCR-VL (~0.9B), GLM-OCR,
  MinerU2.5, Granite-Docling-258M, Dolphin.
- **Structured extraction (JSON/fields)** — small instruct LLMs that fill a
  supplied schema (e.g. Qwen3-VL 4B/8B, GLM-OCR for forms).
- **Summarize & Q&A over documents** — small GGUF LLMs via llama.cpp
  (e.g. Qwen3 4B/8B, Llama 3.2 3B, Phi-class), quant-matched to the PC.
- **General / test** — a small general model for the test panel.

Each card: category, size, quant options, context, license, source, and the live
per-user verdict. (Exact models are chosen at build time from current model
cards — the names above are candidates to verify, not a frozen list.)

---

## 8. UX / UI plan

**Models section** (replaces the current hardware-only panel):
- **"Your PC"** header card — CPU, available RAM, GPU/VRAM, disk, and an overall
  *capability index* ("Good for small models", "Can run mid-size with a GPU", …).
- **Catalogue** grouped by capability (tabs/filters mirroring the tools gallery),
  each model a card with a **verdict badge** (green/amber/red), size, license, and
  Download / Queued / Installed / Remove, plus a **Test** action once installed.
- **Engine packs** listed alongside, same verdict treatment.
- A **downloads tray** (progress, pause/cancel) in the status bar.

**Feature screens** (each its own tool page, like today):
- An **engine picker** at the top (dropdown or segmented control) showing each
  engine with its verdict; default is the bundled engine.
- Feature-specific widgets (OCR: language, output = searchable PDF / text / JSON;
  layout preview). A visual, per-page result where it makes sense (reuse the
  page-grid component).
- "This runs locally" / model-in-use indicator for trust.

**Trust & traceability** (ties to PRISM's positioning): every AI result links
back to the source page/region; the active model/engine is always visible.

---

## 9. Edge cases, crashes & optimization (design for these up front)

- **OOM / memory pressure** — precheck the budget; during inference watch
  available RAM and abort gracefully with "switch to a smaller model/quant"
  rather than crashing. Cap context length; offer KV-cache quantization
  (`q8_0`) to roughly halve cache.
- **GPU detected ≠ usable** — verify the backend; fall back to CPU with a clear
  "will be slower" note.
- **Thermal throttling** on long jobs — chunk work, show progress, allow cancel.
- **Downloads** — resume partial, checksum, fail clearly on disk-full; never
  leave a half-written model that "exists" but is corrupt.
- **Concurrency** — one heavy model loaded at a time; queue feature runs; don't
  let a benchmark and an inference fight for RAM.
- **Cross-platform runtimes** — llama.cpp/tesseract/engine packs are per-OS; CI
  builds/fetches them per platform (same rule as the backend).
- **Licensing** — only permissive models in the curated catalog; show the
  model's own license; warn before a force-download of a non-recommended model.
- **Packaging weight** — heavy engines are never bundled; they're managed
  downloads into an app-owned uv venv.
- **First run** — large model downloads are explicit, resumable, and backgrounded;
  features that need a model prompt to fetch it with the verdict shown first.

---

## 10. Phased build

1. **Engine framework + Models v1** — Capability/Engine registry, HardwareProfiler
   (real GPU/VRAM), ModelCatalog + CompatibilityEngine (memory math + reference
   tok/s), DownloadManager, redesigned Models screen with verdicts.
2. **OCR capability** — Tesseract bundled (works offline, no download), OCR screen
   with engine picker + output options; searchable-PDF output.
3. **llama.cpp runtime + a first LLM capability** — "Extract fields (JSON)" and/or
   "Summarize", with the model picker + verdicts; BenchmarkRunner.
4. **Optional engine packs** — Docling / PaddleOCR-VL / Dolphin via managed venv.
5. **Test/playground panel**, then expand capabilities (Q&A, classify, …).

---

## 11. Open decisions (need your call)

1. **Default OCR output** — searchable PDF, plain text, or structured JSON first?
2. **Engine packs via a managed uv venv** acceptable, or prefer self-contained
   per-engine binaries where they exist (e.g. PaddleOCR has some)?
3. **Catalogue breadth** — a tight curated set (fewer, well-tested) vs a broad
   list? (Recommend tight to start.)
4. **Minimum target tok/s** for the "Runs comfortably" threshold.
5. **Test panel scope** — single-shot "run on a sample" only, or a small chat?

---

## Sources

- [Docling (arXiv report)](https://arxiv.org/html/2501.17887v1) · [Docling on PyPI](https://pypi.org/project/docling/1.13.0)
- [ByteDance Dolphin model card](https://huggingface.co/ByteDance/Dolphin/blob/refs%2Fpr%2F9/README.md) · [bytedance/Dolphin (GitHub)](https://github.com/bytedance/Dolphin)
- [Best open-source OCR models 2026 (Roboflow)](https://roboflow.com/blog/best-open-source-ocr-models) · [Best local OCR models (vdf.ai)](https://vdf.ai/blog/best-local-ocr-models/) · [Top open-source OCR (KDnuggets)](https://www.kdnuggets.com/top-7-open-source-ocr-models)
- [Local LLM memory/quantization math (Cloudzy)](https://cloudzy.com/blog/local-llm-memory-quantization-math/) · [llama.cpp context size & KV cache (fast.io)](https://fast.io/resources/llama-cpp-context-size.md) · [Why llama.cpp uses so much VRAM (llama.cpp #9784)](https://github.com/ggml-org/llama.cpp/discussions/9784)
