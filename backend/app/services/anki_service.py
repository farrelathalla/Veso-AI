from app.db.supabase import get_db
from app.db.models import AnkiDeck, AnkiCard
import uuid


def save_deck_and_cards(user_id: str, topic: str, cards: list[dict], title: str | None = None) -> dict:
    db = get_db()
    deck = AnkiDeck(
        id=str(uuid.uuid4()),
        user_id=user_id,
        title=(title or topic)[:80],
        topic=topic,
        card_count=len(cards),
    )
    db.table("anki_decks").insert(deck.model_dump()).execute()

    card_rows = []
    for i, c in enumerate(cards):
        card = AnkiCard(
            id=str(uuid.uuid4()),
            deck_id=deck.id,
            user_id=user_id,
            front=c["front"],
            back=c["back"],
            difficulty=c["difficulty"],
            card_type=c["card_type"],
            position=i,
        )
        card_rows.append(card.model_dump())

    if card_rows:
        db.table("anki_cards").insert(card_rows).execute()

    return {"deck_id": deck.id, "title": deck.title, "card_count": len(card_rows)}


def get_user_decks(user_id: str) -> list[dict]:
    db = get_db()
    return (
        db.table("anki_decks")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data or []
    )


def get_deck_cards(deck_id: str, user_id: str) -> list[dict]:
    db = get_db()
    return (
        db.table("anki_cards")
        .select("*")
        .eq("deck_id", deck_id)
        .eq("user_id", user_id)
        .order("position")
        .execute()
        .data or []
    )


def delete_deck(deck_id: str, user_id: str) -> None:
    db = get_db()
    db.table("anki_decks").delete().eq("id", deck_id).eq("user_id", user_id).execute()
