# PRISM Documents — backend

Local-first FastAPI service for PDF operations and (later) document intelligence.
Managed with [uv](https://docs.astral.sh/uv/).

## Develop

```bash
cd backend
uv sync --extra dev          # create .venv and install deps
uv run prism-backend          # start on 127.0.0.1 with an OS-assigned port
```

On startup it prints one JSON line to stdout, e.g.:

```json
{"event": "prism-backend-ready", "host": "127.0.0.1", "port": 52173, "pid": 4312}
```

and (in standalone runs) a dev token on stderr. The Electron shell reads the
port from stdout and supplies the token via the `PRISM_AUTH_TOKEN` env var.

## Test

```bash
uv run pytest
```

## Security model

- Binds only to `127.0.0.1` (loopback) — never reachable from the network.
- The OS assigns a free ephemeral port (`:0`), so it never collides with other apps.
- Every request except `/health` requires the `X-Prism-Token` header, compared in
  constant time against the per-session token.

## Design notes

- Operations take **file paths**, not uploaded bytes — the shell and backend are
  on the same machine, so this avoids copying large PDFs over the loopback.
- Page numbers in the API are **1-indexed**.
- PDF engine libraries are permissively licensed (pypdf = BSD, pdfplumber = MIT)
  to stay compatible with this project's MIT license. See `../THIRD_PARTY_NOTICES.md`.
