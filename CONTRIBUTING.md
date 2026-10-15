# Contributing to PRISM Documents

Thanks for your interest in improving PRISM Documents! This guide covers how to
set up, test, and submit changes.

## Ground rules

- Be respectful — see the [Code of Conduct](CODE_OF_CONDUCT.md).
- Keep PRISM **freely redistributable**: only add dependencies with permissive
  licenses (MIT, BSD, Apache-2.0, MPL-2.0). **Do not** add AGPL/GPL runtime
  dependencies (e.g. PyMuPDF) — they conflict with this project's MIT license.
  If in doubt, open an issue first.
- Keep AI/model features **optional**: the PDF tools must work on a machine that
  cannot run any model.

## Development setup

```bash
# Backend (Python, uv)
cd backend
uv sync --extra dev
uv run pytest
uv run ruff check src

# Desktop (Electron)
cd ../desktop
npm install
npm start
```

## Where things live

| Area | Path |
|------|------|
| Backend API & PDF ops | `backend/src/prism_backend/` |
| Backend tests | `backend/tests/` |
| Capability registry (the tool catalog) | `backend/src/prism_backend/registry.py` |
| Electron main process & sidecar | `desktop/src/main/` |
| Renderer UI | `desktop/src/renderer/` |

## Adding a tool

Because the home carousel, tools gallery, and command palette all render from
the registry, adding a tool is usually two steps:

1. Add a backend operation in `services/` and expose it via a router.
2. Add an entry to `registry.py` (`id`, `name`, `category`, `icon`,
   `execution`, `endpoint`, `status`).

Then wire a runner in `desktop/src/renderer/ops.js`. Set `status` honestly:
`ready` (shipped & tested), `beta`, or `planned`.

## Tests

- Backend: `uv run pytest` — please add tests for new operations.
- Keep `uv run ruff check src` clean (line length 100).

## Commit & PR

- Branch from `main` with a descriptive name (`feat/…`, `fix/…`, `docs/…`).
- Keep PRs focused; describe the change and how you tested it.
- CI should pass (tests + lint) before review.

## Reporting bugs / requesting features

Open a GitHub issue with steps to reproduce (for bugs) or a short rationale and
use case (for features).
