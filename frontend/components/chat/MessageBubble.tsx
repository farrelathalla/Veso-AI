"use client"
import { useState } from "react"
import { Copy, Check } from "lucide-react"
import type { Message } from "@/lib/types"

interface Props {
  message: Message
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === "user"
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[65%]">
          <div className="bg-surface-2 rounded-xl rounded-br-sm px-4 py-3 text-sm text-neutral leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
          <div className="text-[11px] text-surface-4 text-right mt-1">You</div>
        </div>
        <div className="w-7 h-7 rounded-full bg-surface-3 flex-shrink-0 flex items-center justify-center text-xs font-semibold text-neutral mt-1">
          U
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      {/* AI avatar */}
      <div className="w-7 h-7 rounded-full bg-brand-primary flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-1">
        V
      </div>

      <div className="max-w-[75%] flex flex-col gap-1.5">
        {/* Bubble */}
        <div className="bg-surface-2 rounded-xl rounded-bl-sm px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neutral">Response</span>
            {!isStreaming && message.content && (
              <span className="text-[11px] text-surface-4">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <div className="text-sm text-neutral leading-[1.7] whitespace-pre-wrap">
            {message.content}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-brand-primary animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        </div>

        {/* Actions */}
        {!isStreaming && message.content && (
          <div className="flex justify-end">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1 bg-surface-2 hover:bg-surface-3 rounded-md text-[12px] text-surface-4 hover:text-neutral transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
