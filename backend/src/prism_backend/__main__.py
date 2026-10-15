"""CLI entrypoint: ``python -m prism_backend`` / ``prism-backend``."""

from __future__ import annotations

import argparse

from .config import DEFAULT_HOST
from .server import run


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
