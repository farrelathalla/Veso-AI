import httpx
from fastapi import HTTPException, status
from app.core.config import settings


async def get_current_user(token: str) -> dict:
    """Verify session by calling the NextAuth session endpoint."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.nextjs_url}/api/auth/session",
                headers={"Cookie": f"next-auth.session-token={token}"},
            )
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not reach auth service",
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )

    data = resp.json()
    if not data or "user" not in data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    return {
        "id": data["user"].get("id", data["user"].get("email", "")),
        "email": data["user"]["email"],
        "name": data["user"].get("name", ""),
    }
