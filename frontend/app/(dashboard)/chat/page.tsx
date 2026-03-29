"use client"
import { useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { MessageBubble } from "@/components/chat/MessageBubble"
import { ChatInput } from "@/components/chat/ChatInput"
import { streamChat } from "@/lib/api"
import type { Message } from "@/lib/types"
import Image from "next/image"
import Logo from "@/public/logo.png"

export default function NewChatPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pendingConvId = useRef<string | null>(null)
  // Ref-based streaming to avoid stale closure batching bug
  const streamingContentRef = useRef("")
  const rafRef = useRef<number | null>(null)

  const updateMessages = (updater: (prev: Message[]) => Message[]) => setMessages(updater)

  const scroll = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" })

  const handleSend = (
    text: string,
    opts: { useRag: boolean; useSearch: boolean; attachedFile?: string }
  ) => {
    if (!session || streaming) return
    setError(null)
    streamingContentRef.current = ""
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }

    const userMsg: Message = { role: "user", content: text, attachedFile: opts.attachedFile }
    const aiMsg: Message = { role: "assistant", content: "" }
    updateMessages(prev => [...prev, userMsg, aiMsg])
    setStreaming(true)
    // Scroll after state update (setTimeout 0 gives React time to render)
    setTimeout(scroll, 0)

    streamChat(
      { message: text, conversation_id: pendingConvId.current ?? undefined, use_rag: opts.useRag, use_search: opts.useSearch, attached_file: opts.attachedFile },
      session,
      (token) => {
        streamingContentRef.current += token
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null
            updateMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { ...updated[updated.length - 1], content: streamingContentRef.current }
              return updated
            })
            scroll()
          })
        }
      },
      (meta) => { pendingConvId.current = meta.conversation_id },
      () => {
        // Final flush
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
        updateMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: streamingContentRef.current }
          return updated
        })
        setStreaming(false)
        scroll()
      },
      (err) => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
        setStreaming(false)
        setError(err)
      },
      (sources) => {
        updateMessages(prev => {
          const updated = [...prev]
          const lastAssistant = [...updated].reverse().find(m => m.role === "assistant")
          if (lastAssistant) {
            const idx = updated.lastIndexOf(lastAssistant)
            updated[idx] = { ...updated[idx], sources }
          }
          return updated
        })
      }
    )
  }

  const handleSummary = (summary: string) => {
    updateMessages(prev => [...prev, { role: "assistant", content: summary }])
    setTimeout(scroll, 0)
  }

  const handleAnkiStart = (userMessage: { topic: string; attachedFile?: string }) => {
    updateMessages(prev => [
      ...prev,
      { role: "user", content: userMessage.topic, attachedFile: userMessage.attachedFile },
      { role: "assistant", content: "Creating Anki cards...", isLoading: true },
    ])
    setTimeout(scroll, 0)
  }

  const handleAnkiCreated = (
    deck: { id: string; title: string; card_count: number },
    userMessage: { topic: string; attachedFile?: string }
  ) => {
    updateMessages(prev => {
      const updated = [...prev]
      const lastIdx = updated.length - 1
      if (lastIdx >= 0 && updated[lastIdx].isLoading) {
        updated[lastIdx] = { role: "assistant", content: "", ankiDeck: deck }
      } else {
        updated.push({ role: "assistant", content: "", ankiDeck: deck })
      }
      return updated
    })
    setTimeout(scroll, 0)
  }

  const handleAnkiError = () => {
    updateMessages(prev => {
      const updated = [...prev]
      const lastIdx = updated.length - 1
      if (lastIdx >= 0 && updated[lastIdx].isLoading) {
        updated[lastIdx] = { role: "assistant", content: "Failed to generate Anki cards. Please try again." }
      }
      return updated
    })
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
            <div className="w-8 flex items-center justify-center mb-4">
              <Image src={Logo} alt="Logo" />
            </div>
            <h2 className="text-neutral font-semibold text-lg mb-2">
              What can I help you learn?
            </h2>
            <p className="text-surface-4 text-sm max-w-xs leading-relaxed">
              Ask a medical question, upload a file to summarise, or request
              Anki cards on any topic.
            </p>
            <button
              onClick={() => window.dispatchEvent(new Event("veso:open-tutorial"))}
              className="mt-4 text-[12px] text-surface-4 hover:text-brand-primary transition-colors underline-offset-2 hover:underline"
            >
              How it works
            </button>
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

      <ChatInput
        onSend={handleSend}
        onSummary={handleSummary}
        onAnkiCreated={handleAnkiCreated}
        onAnkiStart={handleAnkiStart}
        onAnkiError={handleAnkiError}
        disabled={streaming}
      />
    </div>
  )
}
