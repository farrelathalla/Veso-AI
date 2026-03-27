import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.api.deps import current_user
from app.db.models import ChatRequest
from app.services.chat_service import (
    get_or_create_conversation,
    get_conversation_history,
    save_message,
    get_user_conversations,
    update_conversation_title,
    delete_conversation,
    build_messages_with_context,
)
from app.rag.vector_store import retrieve_context, retrieve_from_source
from app.services.llm import stream_response, generate_title
from app.agents.search_agent import search_and_answer

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/conversations")
async def list_conversations(user=Depends(current_user)):
    return get_user_conversations(user["id"])


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str, user=Depends(current_user)):
    # Verify the conversation belongs to the requesting user before returning messages
    from app.db.supabase import get_db
    db = get_db()
    row = db.table("conversations").select("id").eq("id", conversation_id).eq("user_id", user["id"]).maybe_single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return get_conversation_history(conversation_id, limit=100)


@router.delete("/conversations/{conversation_id}")
async def remove_conversation(conversation_id: str, user=Depends(current_user)):
    delete_conversation(conversation_id, user["id"])
    return {"status": "deleted"}


@router.post("/stream")
async def chat_stream(req: ChatRequest, user=Depends(current_user)):
    """SSE streaming chat endpoint."""
    # Validate message length
    if not req.message.strip():
        return {"error": "Empty message"}
    if len(req.message) > 4000:
        return {"error": "Message too long (max 4000 chars)"}

    # 1. Get or create conversation — must happen before streaming starts
    conv_id = get_or_create_conversation(user["id"], req.conversation_id)

    # 2. Save user message immediately (before streaming, so it's always persisted)
    user_meta = {"attachedFile": req.attached_file} if req.attached_file else {}
    save_message(conv_id, "user", req.message, metadata=user_meta)

    # 3. Load recent history (after saving current message so context is accurate)
    history = get_conversation_history(conv_id, limit=12)

    # 4. RAG retrieval (skipped if use_search=True — search provides its own context)
    rag_context = None
    if req.use_rag and not req.use_search:
        if req.attached_file:
            # User attached a specific file — retrieve from it directly instead of semantic search
            rag_context = retrieve_from_source(req.attached_file, k=6)
        else:
            rag_context = retrieve_context(req.message, k=4)

    # 5. Build message list
    messages = build_messages_with_context(history[:-1], req.message, rag_context)

    # 6. Stream response
    full_response: list[str] = []

    async def event_generator():
        # Send conversation_id first so client can update URL immediately
        yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conv_id})}\n\n"

        try:
            stream = search_and_answer(req.message, history[:-1]) if req.use_search else stream_response(messages)
            async for token in stream:
                full_response.append(token)
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            # Persist assistant reply
            complete = "".join(full_response)
            save_message(conv_id, "assistant", complete)

            # Auto-title from first user message
            if len(history) <= 1:
                title = await generate_title(req.message)
                update_conversation_title(conv_id, title)

        except Exception:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Generation failed. Please try again.'})}\n\n"

        finally:
            yield f"data: {json.dumps({'type': 'done', 'conversation_id': conv_id})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
