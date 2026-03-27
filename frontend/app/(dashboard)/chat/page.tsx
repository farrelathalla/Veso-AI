"use client"
import { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { MessageBubble } from "@/components/chat/MessageBubble"
import { ChatInput } from "@/components/chat/ChatInput"
import { streamChat } from "@/lib/api"
import type { Message } from "@/lib/types"

export default function NewChatPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

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
      { message: text, use_rag: opts.useRag, use_search: opts.useSearch },
      session,
      token => setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        updated[updated.length - 1] = { ...last, content: last.content + token }
        return updated
      }),
      meta => router.replace(`/chat/${meta.conversation_id}`),
      () => setStreaming(false),
      err => { setStreaming(false); setError(err) },
    )
  }

  const handleSummary = (summary: string) => {
    const summaryMsg: Message = { role: "assistant", content: summary }
    setMessages(prev => [...prev, summaryMsg])
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-5 h-[52px] border-b border-surface-2/50 flex-shrink-0">
        <h1 className="text-neutral font-semibold">New Chat</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[300px]">
            <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mb-4">
              <span className="text-brand-primary font-bold text-2xl">V</span>
            </div>
            <h2 className="text-neutral font-semibold text-lg mb-2">What can I help you learn?</h2>
            <p className="text-surface-4 text-sm max-w-xs leading-relaxed">
              Ask a medical question, upload a file to summarise, or request Anki cards on any topic.
            </p>
          </div>
        )}
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
