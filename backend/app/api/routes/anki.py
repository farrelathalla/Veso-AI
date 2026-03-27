from fastapi import APIRouter, Depends, HTTPException, Request
from app.api.deps import current_user
from app.core.limiter import limiter
from app.db.supabase import get_db
from app.db.models import AnkiGenerateRequest
from app.agents.anki_agent import generate_anki_cards
from app.rag.vector_store import retrieve_context, retrieve_from_source
from app.agents.search_agent import _run_search
from app.services.llm import generate_title
from app.services.anki_service import (
    save_deck_and_cards,
    get_user_decks,
    get_deck_cards,
    delete_deck,
)
from app.services.chat_service import save_message

router = APIRouter(prefix="/anki", tags=["anki"])


@router.post("/generate")
@limiter.limit("15/minute")
async def generate(request: Request, req: AnkiGenerateRequest, user=Depends(current_user)):
    """Generate Anki cards for a topic and persist them."""
    # Retrieve context — file-specific, semantic RAG, or web search (or any combination)
    if req.attached_file:
        rag_chunks = retrieve_from_source(req.attached_file, k=10) or []
    else:
        rag_chunks = retrieve_context(req.topic, k=6) or []
    rag_context = "\n\n".join(rag_chunks)

    search_context = ""
    if req.use_search:
        raw = _run_search(req.topic)
        if raw and not raw.startswith("Search failed") and raw != "No results found.":
            search_context = f"Web search results for '{req.topic}':\n\n{raw}"

    combined_context = "\n\n".join(filter(None, [req.additional_context or "", rag_context, search_context]))

    cards = await generate_anki_cards(
        topic=req.topic,
        context=combined_context,
        max_cards=req.max_cards,
    )
    if not cards:
        return {"error": "Failed to generate cards. Try a more specific topic."}

    # When a file is attached, derive the deck title from the file content rather than the user's instruction
    if req.attached_file and rag_chunks:
        clean_title = await generate_title(rag_chunks[0][:300])
    else:
        clean_title = await generate_title(req.topic)
    result = save_deck_and_cards(user["id"], req.topic, cards, title=clean_title)

    # Persist user + assistant messages into the chat conversation when generated from chat
    if req.conversation_id:
        db = get_db()
        conv_row = (
            db.table("conversations")
            .select("id")
            .eq("id", req.conversation_id)
            .eq("user_id", user["id"])
            .maybe_single()
            .execute()
        )
        if conv_row.data:
            user_meta = {"attachedFile": req.attached_file} if req.attached_file else {}
            save_message(req.conversation_id, "user", req.topic, metadata=user_meta)
            save_message(
                req.conversation_id,
                "assistant",
                "",
                metadata={
                    "ankiDeck": {
                        "id": result["deck_id"],
                        "title": result["title"],
                        "card_count": result["card_count"],
                    }
                },
            )

    return {**result, "cards": cards}


@router.get("/decks")
@limiter.limit("60/minute")
async def list_decks(request: Request, user=Depends(current_user)):
    return get_user_decks(user["id"])


@router.get("/decks/{deck_id}/cards")
@limiter.limit("60/minute")
async def list_cards(request: Request, deck_id: str, user=Depends(current_user)):
    # Verify the deck belongs to the requesting user
    db = get_db()
    row = db.table("anki_decks").select("id").eq("id", deck_id).eq("user_id", user["id"]).maybe_single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Deck not found")
    return get_deck_cards(deck_id, user["id"])


@router.delete("/decks/{deck_id}")
@limiter.limit("30/minute")
async def remove_deck(request: Request, deck_id: str, user=Depends(current_user)):
    delete_deck(deck_id, user["id"])
    return {"status": "deleted"}
