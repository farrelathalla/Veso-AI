from typing import Optional
from app.db.supabase import get_db
from app.db.models import Conversation, Message
import uuid


def get_or_create_conversation(user_id: str, conversation_id: Optional[str]) -> str:
    db = get_db()
    if conversation_id:
        # Verify it belongs to this user
        row = db.table("conversations").select("id").eq("id", conversation_id).eq("user_id", user_id).maybe_single().execute()
        if row.data:
            return conversation_id
    conv = Conversation(id=str(uuid.uuid4()), user_id=user_id)
    db.table("conversations").insert(conv.model_dump()).execute()
    return conv.id


def get_conversation_history(conversation_id: str, limit: int = 12) -> list[dict]:
    db = get_db()
    result = (
        db.table("messages")
        .select("role, content, metadata")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .limit(limit)
        .execute()
    )
    return result.data or []


def save_message(conversation_id: str, role: str, content: str, metadata: dict | None = None) -> None:
    if metadata is None:
        metadata = {}
    db = get_db()
    msg = Message(conversation_id=conversation_id, role=role, content=content, metadata=metadata)
    db.table("messages").insert(msg.model_dump()).execute()


def get_user_conversations(user_id: str) -> list[dict]:
    db = get_db()
    result = (
        db.table("conversations")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(100)
        .execute()
    )
    return result.data or []


def update_conversation_title(conversation_id: str, title: str) -> None:
    from datetime import datetime
    db = get_db()
    db.table("conversations").update({
        "title": title,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", conversation_id).execute()


def delete_conversation(conversation_id: str, user_id: str) -> None:
    db = get_db()
    db.table("conversations").delete().eq("id", conversation_id).eq("user_id", user_id).execute()


def build_messages_with_context(
    history: list[dict],
    user_message: str,
    rag_context: list[str] | None,
) -> list[dict]:
    """Assemble message list, injecting RAG context into the final user turn."""
    messages = list(history)
    content = user_message
    if rag_context:
        context_block = "\n\n---\n".join(rag_context)
        content = (
            f"Relevant context from the medical knowledge base:\n\n{context_block}"
            f"\n\n---\n\nStudent question: {user_message}"
        )
    messages.append({"role": "user", "content": content})
    return messages
