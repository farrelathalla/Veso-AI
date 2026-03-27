const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

function authHeaders(session: any): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${(session as any)?.accessToken ?? ""}`,
  }
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function getConversations(session: any) {
  const res = await fetch(`${BASE}/api/chat/conversations`, {
    headers: authHeaders(session),
  })
  if (!res.ok) return []
  return res.json()
}

export async function getMessages(conversationId: string, session: any) {
  const res = await fetch(`${BASE}/api/chat/conversations/${conversationId}/messages`, {
    headers: authHeaders(session),
  })
  if (!res.ok) return []
  return res.json()
}

export async function deleteConversation(conversationId: string, session: any) {
  await fetch(`${BASE}/api/chat/conversations/${conversationId}`, {
    method: "DELETE",
    headers: authHeaders(session),
  })
}

// ── Streaming chat ────────────────────────────────────────────────────────────

export function streamChat(
  payload: {
    message: string
    conversation_id?: string
    use_rag?: boolean
    use_search?: boolean
    attached_file?: string
  },
  session: any,
  onToken: (token: string) => void,
  onMeta: (meta: { conversation_id: string }) => void,
  onDone: () => void,
  onError?: (err: string) => void,
): () => void {
  const ctrl = new AbortController()

  ;(async () => {
    try {
      const res = await fetch(`${BASE}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(session as any)?.accessToken ?? ""}`,
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) {
        onError?.(`Request failed: ${res.status}`)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const json = JSON.parse(line.slice(6))
            if (json.type === "meta") onMeta(json)
            if (json.type === "token") onToken(json.content)
            if (json.type === "done") onDone()
          } catch {
            // ignore malformed SSE line
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        onError?.(err?.message ?? "Stream error")
      }
    }
  })()

  return () => ctrl.abort()
}

// ── Anki ─────────────────────────────────────────────────────────────────────

export async function generateAnki(
  payload: { topic: string; additional_context?: string; max_cards?: number; conversation_id?: string; attached_file?: string; use_search?: boolean },
  session: any,
) {
  const res = await fetch(`${BASE}/api/anki/generate`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function getAnkiDecks(session: any) {
  const res = await fetch(`${BASE}/api/anki/decks`, {
    headers: authHeaders(session),
  })
  if (!res.ok) return []
  return res.json()
}

export async function getDeckCards(deckId: string, session: any) {
  const res = await fetch(`${BASE}/api/anki/decks/${deckId}/cards`, {
    headers: authHeaders(session),
  })
  if (!res.ok) return []
  return res.json()
}

export async function deleteDeck(deckId: string, session: any) {
  await fetch(`${BASE}/api/anki/decks/${deckId}`, {
    method: "DELETE",
    headers: authHeaders(session),
  })
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export async function uploadAndSummarize(
  file: File,
  session: any,
  onToken: (t: string) => void,
  onDone: () => void,
  onError?: (e: string) => void,
) {
  const form = new FormData()
  form.append("file", file)
  try {
    const res = await fetch(`${BASE}/api/pdf/summarize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${(session as any)?.accessToken ?? ""}` },
      body: form,
    })
    if (!res.ok || !res.body) {
      onError?.(`Upload failed: ${res.status}`)
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split("\n")
      buf = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        try {
          const json = JSON.parse(line.slice(6))
          if (json.type === "token") onToken(json.content)
          if (json.type === "done") onDone()
        } catch {
          // ignore
        }
      }
    }
  } catch (err: any) {
    onError?.(err?.message ?? "Upload error")
  }
}

export async function uploadFile(file: File, session: any): Promise<{ filename: string; chunks_ingested: number }> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${BASE}/api/pdf/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${(session as any)?.accessToken ?? ""}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  return res.json()
}

// ── RAG ───────────────────────────────────────────────────────────────────────

export async function triggerIngest(session: any) {
  const res = await fetch(`${BASE}/api/rag/ingest`, {
    method: "POST",
    headers: authHeaders(session),
  })
  return res.json()
}

export async function getRagStatus(session: any) {
  const res = await fetch(`${BASE}/api/rag/status`, {
    headers: authHeaders(session),
  })
  return res.json()
}
