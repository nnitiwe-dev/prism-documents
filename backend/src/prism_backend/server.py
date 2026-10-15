"""Server bootstrap.

We bind our own socket to ``127.0.0.1:0`` so the OS assigns a free ephemeral
port (this is what guarantees we never collide with another app). We learn the
chosen port via ``getsockname()`` *before* serving, print a single JSON "ready"
line to stdout so the Electron shell can discover it, then hand the socket to
uvicorn.
"""

from __future__ import annotations

import asyncio
import json
import os
import socket
import sys

import uvicorn

from .app import create_app
from .config import load_settings

READY_EVENT = "prism-backend-ready"


def run(host: str | None = None, port: int | None = None) -> None:
    settings = load_settings(host, port)
    app = create_app(settings)

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((settings.host, settings.port))
    actual_port = sock.getsockname()[1]
    settings.port = actual_port

    # Discovery handshake: the shell reads stdout until it sees this line.
    ready = {
        "event": READY_EVENT,
        "host": settings.host,
        "port": actual_port,
        "pid": os.getpid(),
    }
    print(json.dumps(ready), flush=True)
    if not settings.token_from_env:
        # Standalone/dev run: surface the generated token on stderr only.
        print(f"[prism-backend] dev token: {settings.token}", file=sys.stderr, flush=True)

    config = uvicorn.Config(app, log_level="warning", access_log=False)
    server = uvicorn.Server(config)
    asyncio.run(server.serve(sockets=[sock]))
