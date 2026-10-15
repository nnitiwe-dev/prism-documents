"""Per-request token authentication.

The token is compared in constant time. Combined with binding to 127.0.0.1,
this keeps the backend private to the local shell that launched it.
"""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, Request, status

from .config import TOKEN_HEADER


async def verify_token(
    request: Request,
    x_prism_token: str | None = Header(default=None, alias=TOKEN_HEADER),
) -> bool:
    expected = request.app.state.settings.token
    if x_prism_token is None or not hmac.compare_digest(x_prism_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing authentication token",
        )
    return True
