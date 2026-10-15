"""Runtime settings for the backend.

The auth token is supplied by the Electron shell via the ``PRISM_AUTH_TOKEN``
environment variable. When the backend is run standalone (development), a random
token is generated so the service is still protected.
"""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass, field

DEFAULT_HOST = "127.0.0.1"
TOKEN_ENV = "PRISM_AUTH_TOKEN"
TOKEN_HEADER = "X-Prism-Token"


@dataclass
class Settings:
    host: str = DEFAULT_HOST
    port: int = 0  # 0 => let the OS pick a free ephemeral port
    token: str = field(
        default_factory=lambda: os.environ.get(TOKEN_ENV) or secrets.token_urlsafe(32)
    )

    @property
    def token_from_env(self) -> bool:
        return bool(os.environ.get(TOKEN_ENV))


def load_settings(host: str | None = None, port: int | None = None) -> Settings:
    settings = Settings()
    if host:
        settings.host = host
    if port is not None:
        settings.port = port
    return settings
