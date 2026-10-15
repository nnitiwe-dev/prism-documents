"""CLI entrypoint: ``python -m prism_backend`` / ``prism-backend``.

Uses absolute imports (not relative) so this file works both as a package module
(`python -m prism_backend`) and as a PyInstaller entry script, where it runs as
a top-level ``__main__`` with no parent package.
"""

from __future__ import annotations

import argparse

from prism_backend.config import DEFAULT_HOST
from prism_backend.server import run


def main() -> None:
    parser = argparse.ArgumentParser(prog="prism-backend")
    parser.add_argument(
        "--host", default=DEFAULT_HOST, help="Loopback host to bind (default 127.0.0.1)"
    )
    parser.add_argument(
        "--port", type=int, default=0, help="Port to bind; 0 = OS-assigned (recommended)"
    )
    args = parser.parse_args()
    run(host=args.host, port=args.port)


if __name__ == "__main__":
    main()
