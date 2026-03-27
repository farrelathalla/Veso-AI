from typing import Optional
from fastapi import Depends, Header, HTTPException
from app.core.auth import get_current_user


async def current_user(
    authorization: Optional[str] = Header(None),
):
    """Extract and verify user from Authorization: Bearer <session_token> header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty token")
    return await get_current_user(token)
