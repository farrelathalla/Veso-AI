from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import current_user
from app.db.supabase import get_db
from app.db.models import AnkiGenerateRequest
from app.agents.anki_agent import generate_anki_cards
from app.services.anki_service import (
    save_deck_and_cards,
    get_user_decks,
    get_deck_cards,
    delete_deck,
)

router = APIRouter(prefix="/anki", tags=["anki"])


@router.post("/generate")
async def generate(req: AnkiGenerateRequest, user=Depends(current_user)):
    """Generate Anki cards for a topic and persist them."""
    cards = await generate_anki_cards(
        topic=req.topic,
        context=req.additional_context or "",
        max_cards=req.max_cards,
    )
    if not cards:
        return {"error": "Failed to generate cards. Try a more specific topic."}

    result = save_deck_and_cards(user["id"], req.topic, cards)
    return {**result, "cards": cards}


@router.get("/decks")
async def list_decks(user=Depends(current_user)):
    return get_user_decks(user["id"])


@router.get("/decks/{deck_id}/cards")
async def list_cards(deck_id: str, user=Depends(current_user)):
    # Verify the deck belongs to the requesting user
    db = get_db()
    row = db.table("anki_decks").select("id").eq("id", deck_id).eq("user_id", user["id"]).maybe_single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Deck not found")
    return get_deck_cards(deck_id, user["id"])


@router.delete("/decks/{deck_id}")
async def remove_deck(deck_id: str, user=Depends(current_user)):
    delete_deck(deck_id, user["id"])
    return {"status": "deleted"}
