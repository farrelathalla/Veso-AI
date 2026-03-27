"use client"
import { useState, useRef, KeyboardEvent, ChangeEvent } from "react"
import { Send, Search, Paperclip, X } from "lucide-react"
import { uploadAndSummarize } from "@/lib/api"
import { useSession } from "next-auth/react"

interface Props {
  onSend: (message: string, options: { useRag: boolean; useSearch: boolean }) => void
  onSummary?: (text: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, onSummary, disabled }: Props) {
  const { data: session } = useSession()
  const [text, setText] = useState("")
  const [useSearch, setUseSearch] = useState(false)
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    if (!text.trim() || disabled || uploading) return
    onSend(text.trim(), { useRag: true, useSearch })
    setText("")
    setUseSearch(false)
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session) return
    setUploading(true)
    let summary = ""
    await uploadAndSummarize(
      file,
      session,
      token => { summary += token },
      () => {
        setUploading(false)
        if (onSummary) onSummary(summary)
        else {
          // Inject summary as assistant message via a user prompt
          onSend(`Please summarise the uploaded file: ${file.name}`, { useRag: false, useSearch: false })
        }
      },
      err => { setUploading(false); console.error(err) },
    )
    e.target.value = ""
  }

  const isDisabled = disabled || uploading

  return (
    <div className="px-5 py-4 border-t border-surface-2/60 flex-shrink-0">
      {useSearch && (
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-brand-primary/10 border border-brand-primary/20 rounded-md text-[11px] text-brand-primary font-medium">
            <Search size={10} />
            Web search enabled
          </span>
          <button
            onClick={() => setUseSearch(false)}
            className="text-[11px] text-surface-4 hover:text-accent-error transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 bg-surface-2 rounded-xl px-4 py-3 border border-transparent focus-within:border-brand-primary/50 transition-colors">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value); autoResize() }}
          onKeyDown={onKey}
          disabled={isDisabled}
          placeholder={uploading ? "Processing file..." : "Ask questions, or type / for commands"}
          rows={1}
          className="flex-1 bg-transparent text-sm text-neutral placeholder:text-surface-4 outline-none resize-none leading-relaxed disabled:opacity-50"
        />

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* File upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            title="Upload PDF or TXT"
            className="w-8 h-8 flex items-center justify-center rounded-md text-surface-4 hover:text-neutral hover:bg-surface-3 transition-colors disabled:opacity-40"
          >
            <Paperclip size={15} strokeWidth={1.5} />
          </button>

          {/* Web search toggle */}
          <button
            onClick={() => setUseSearch(s => !s)}
            disabled={isDisabled}
            title="Enable web search"
            className={[
              "w-8 h-8 flex items-center justify-center rounded-md transition-colors disabled:opacity-40",
              useSearch
                ? "bg-brand-primary text-white"
                : "text-surface-4 hover:text-neutral hover:bg-surface-3",
            ].join(" ")}
          >
            <Search size={15} strokeWidth={1.5} />
          </button>

          {/* Send */}
          <button
            onClick={submit}
            disabled={!text.trim() || isDisabled}
            className={[
              "w-8 h-8 flex items-center justify-center rounded-md transition-colors",
              text.trim() && !isDisabled
                ? "bg-brand-primary hover:bg-brand-primary/90 text-white"
                : "bg-surface-3 text-surface-4 cursor-not-allowed",
            ].join(" ")}
          >
            <Send size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
