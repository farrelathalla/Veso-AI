"use client"
import { useState, useRef, KeyboardEvent, ChangeEvent } from "react"
import { Send, Search, Paperclip, X, FileText, BookOpen, Loader2 } from "lucide-react"
import { uploadFile, generateAnki } from "@/lib/api"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

interface Props {
  onSend: (message: string, options: { useRag: boolean; useSearch: boolean; attachedFile?: string }) => void
  onSummary?: (text: string) => void
  onAnkiCreated?: (deck: { id: string; title: string; card_count: number }, userMessage: { topic: string; attachedFile?: string }) => void
  disabled?: boolean
  conversationId?: string
}

export function ChatInput({ onSend, onSummary, onAnkiCreated, disabled, conversationId }: Props) {
  const { data: session } = useSession()
  const router = useRouter()
  const [text, setText] = useState("")
  const [useSearch, setUseSearch] = useState(false)
  const [ankiMode, setAnkiMode] = useState(false)
  const [generatingAnki, setGeneratingAnki] = useState(false)
  const [ankiError, setAnkiError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [attachedFile, setAttachedFile] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAnkiGenerate = async () => {
    if (!session || !text.trim() || generatingAnki) return
    // Capture before state is cleared
    const topic = text.trim()
    const fileAttached = attachedFile ?? undefined
    setAnkiError(null)
    setGeneratingAnki(true)
    try {
      const result = await generateAnki({ topic, max_cards: 20, conversation_id: conversationId, attached_file: fileAttached }, session)
      if (result.error) { setAnkiError(result.error); return }
      setText("")
      setAnkiMode(false)
      setAttachedFile(null)
      if (textareaRef.current) textareaRef.current.style.height = "auto"
      if (onAnkiCreated) {
        onAnkiCreated({ id: result.deck_id, title: result.title, card_count: result.card_count }, { topic, attachedFile: fileAttached })
      } else {
        router.push("/anki")
      }
    } catch {
      setAnkiError("Failed to generate cards. Try again.")
    } finally {
      setGeneratingAnki(false)
    }
  }

  const submit = () => {
    if (!text.trim() || disabled || uploading || generatingAnki) return
    if (ankiMode) { handleAnkiGenerate(); return }
    onSend(text.trim(), { useRag: true, useSearch, attachedFile: attachedFile ?? undefined })
    setText("")
    setUseSearch(false)
    setAttachedFile(null)
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
    setUploadError(null)
    try {
      const result = await uploadFile(file, session)
      setAttachedFile(result.filename)
    } catch {
      setUploadError("Upload failed. Try again.")
    } finally {
      setUploading(false)
    }
    e.target.value = ""
  }

  const isDisabled = disabled || uploading || generatingAnki

  return (
    <div className="px-5 py-4 border-t border-surface-2/60 flex-shrink-0">
      {/* Attached file badge */}
      {attachedFile && (
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-brand-primary/10 border border-brand-primary/20 rounded-md text-[11px] text-brand-primary font-medium max-w-[260px] truncate">
            <FileText size={10} />
            {attachedFile}
          </span>
          <button
            onClick={() => setAttachedFile(null)}
            className="text-[11px] text-surface-4 hover:text-accent-error transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="text-[11px] text-accent-error mb-2">{uploadError}</div>
      )}

      {/* Anki mode badge */}
      {ankiMode && (
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-brand-primary/10 border border-brand-primary/20 rounded-md text-[11px] text-brand-primary font-medium">
            <BookOpen size={10} />
            Anki mode — type a topic and press send
          </span>
          <button onClick={() => { setAnkiMode(false); setAnkiError(null) }} className="text-[11px] text-surface-4 hover:text-accent-error transition-colors">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Anki error */}
      {ankiError && <div className="text-[11px] text-accent-error mb-2">{ankiError}</div>}

      {/* Web search badge */}
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
          placeholder={
            uploading
              ? "Uploading file..."
              : generatingAnki
              ? "Generating Anki cards..."
              : ankiMode
              ? "Enter a topic for Anki cards (e.g. Cardiac arrhythmias)..."
              : attachedFile
              ? "Ask something about the uploaded file..."
              : "Ask a medical question or request Anki cards"
          }
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
            className={[
              "w-8 h-8 flex items-center justify-center rounded-md transition-colors disabled:opacity-40",
              attachedFile
                ? "text-brand-primary bg-brand-primary/10"
                : "text-surface-4 hover:text-neutral hover:bg-surface-3",
            ].join(" ")}
          >
            <Paperclip size={15} strokeWidth={1.5} />
          </button>

          {/* Anki mode toggle */}
          <button
            onClick={() => { setAnkiMode(s => !s); setUseSearch(false); setAnkiError(null) }}
            disabled={isDisabled}
            title="Generate Anki cards"
            className={[
              "w-8 h-8 flex items-center justify-center rounded-md transition-colors disabled:opacity-40",
              ankiMode
                ? "bg-brand-primary text-white"
                : "text-surface-4 hover:text-neutral hover:bg-surface-3",
            ].join(" ")}
          >
            <BookOpen size={15} strokeWidth={1.5} />
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
            {generatingAnki
              ? <Loader2 size={15} className="animate-spin" />
              : <Send size={15} strokeWidth={1.5} />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
