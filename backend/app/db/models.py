from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
import uuid


class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    role: Literal["user", "assistant"]
    content: str
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    def model_dump(self, **kwargs):
        d = super().model_dump(**kwargs)
        d["created_at"] = d["created_at"].isoformat()
        return d


class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str = "New Chat"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def model_dump(self, **kwargs):
        d = super().model_dump(**kwargs)
        d["created_at"] = d["created_at"].isoformat()
        d["updated_at"] = d["updated_at"].isoformat()
        return d


class AnkiCard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    deck_id: str
    user_id: str
    front: str
    back: str
    difficulty: Literal["easy", "medium", "hard"]
    card_type: Literal["concept", "conceptual", "clinical"]
    position: int = 0


class AnkiDeck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    topic: Optional[str] = None
    card_count: int = 0


# ── Request / Response schemas ────────────────────────────────────────────────

class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    use_rag: bool = True
    use_search: bool = False


class AnkiGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)
    additional_context: Optional[str] = Field(None, max_length=30_000)
    max_cards: int = Field(default=20, ge=15, le=25)
