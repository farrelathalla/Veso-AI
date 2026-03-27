from fastapi import APIRouter, Depends
from app.api.deps import current_user

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok", "service": "veso-ai-backend"}


@router.get("/me")
async def me(user=Depends(current_user)):
    """Protected route — returns current user info."""
    return user
