"use client"
import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import { MessageBubble } from "@/components/chat/MessageBubble"
import { ChatInput } from "@/components/chat/ChatInput"
import { streamChat, getMessages } from "@/lib/api"
import type { Message } from "@/lib/types"

export default function ConversationPage() {
  const { data: session } = useSession()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!session || !id) return
    setLoading(true)
    getMessages(id, session).then(msgs => {
      setMessages(msgs)
      setLoading(false)
    })
  }, [session, id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = (text: string, opts: { useRag: boolean; useSearch: boolean }) => {
    if (!session || streaming) return
    setError(null)
    const userMsg: Message = { role: "user", content: text }
    const aiMsg: Message = { role: "assistant", content: "" }
    setMessages(prev => [...prev, userMsg, aiMsg])
    setStreaming(true)

    streamChat(
      { message: text, conversation_id: id, use_rag: opts.useRag, use_search: opts.useSearch },
      session,
      token => setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        updated[updated.length - 1] = { ...last, content: last.content + token }
        return updated
      }),
      () => {},
      () => setStreaming(false),
      err => { setStreaming(false); setError(err) },
    )
  }

  const handleSummary = (summary: string) => {
    setMessages(prev => [...prev, { role: "assistant", content: summary }])
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-5 h-[52px] border-b border-surface-2/50 flex-shrink-0">
        <h1 className="text-neutral font-semibold truncate">
          {messages.find(m => m.role === "user")?.content?.slice(0, 50) ?? "Conversation"}
        </h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            isStreaming={streaming && i === messages.length - 1 && msg.role === "assistant"}
          />
        ))}
        {error && (
          <div className="px-4 py-3 bg-accent-error/10 border-l-2 border-accent-error rounded-md text-accent-error text-sm">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} onSummary={handleSummary} disabled={streaming} />
    </div>
  )
}
