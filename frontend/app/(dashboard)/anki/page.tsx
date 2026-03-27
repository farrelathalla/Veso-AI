"use client"
import { useEffect, useRef, useState, ChangeEvent } from "react"
import { useSession } from "next-auth/react"
import { Plus, BookOpen, Trash2, Loader2, Paperclip, Search, X, FileText } from "lucide-react"
import { getAnkiDecks, getDeckCards, generateAnki, deleteDeck, uploadFile } from "@/lib/api"
import { AnkiDeckViewer } from "@/components/anki/AnkiDeckViewer"
import type { AnkiDeck, AnkiCard } from "@/lib/types"

export default function AnkiPage() {
  const { data: session } = useSession()
  const [decks, setDecks] = useState<AnkiDeck[]>([])
  const [activeDeck, setActiveDeck] = useState<{ deck: AnkiDeck; cards: AnkiCard[] } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [topic, setTopic] = useState("")
  const [context, setContext] = useState("")
  const [attachedFile, setAttachedFile] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [useSearch, setUseSearch] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [loadingDeckId, setLoadingDeckId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (session) getAnkiDecks(session).then(setDecks)
  }, [session])

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

  const handleGenerate = async () => {
    if (!session || !topic.trim() || generating) return
    setGenError(null)
    setGenerating(true)
    try {
      const result = await generateAnki({
        topic: topic.trim(),
        additional_context: context.trim() || undefined,
        max_cards: 20,
        attached_file: attachedFile ?? undefined,
        use_search: useSearch || undefined,
      }, session)
      if (result.error) { setGenError(result.error); return }
      const updated = await getAnkiDecks(session)
      setDecks(updated)
      setTopic("")
      setContext("")
      setAttachedFile(null)
      setUseSearch(false)
      setShowNew(false)
    } catch (e: any) {
      setGenError(e?.message ?? "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  const resetForm = () => {
    setShowNew(false)
    setGenError(null)
    setUploadError(null)
    setAttachedFile(null)
    setUseSearch(false)
  }

  const openDeck = async (deck: AnkiDeck) => {
    if (!session) return
    setLoadingDeckId(deck.id)
    const cards = await getDeckCards(deck.id, session)
    setLoadingDeckId(null)
    setActiveDeck({ deck, cards })
  }

  const handleDelete = async (e: React.MouseEvent, deckId: string) => {
    e.stopPropagation()
    if (!session) return
    await deleteDeck(deckId, session)
    setDecks(prev => prev.filter(d => d.id !== deckId))
  }

  if (activeDeck) {
    return (
      <AnkiDeckViewer
        cards={activeDeck.cards}
        deckTitle={activeDeck.deck.title}
        onClose={() => setActiveDeck(null)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-[52px] border-b border-surface-2/50 flex-shrink-0">
        <h1 className="text-neutral font-semibold">Anki Cards</h1>
        <button
          onClick={() => { setShowNew(true); setGenError(null); setUploadError(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/90 rounded-md text-sm text-white font-medium transition-colors"
        >
          <Plus size={15} strokeWidth={2} />
          Generate Deck
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* New deck form */}
        {showNew && (
          <div className="mb-5 p-4 bg-surface-2 rounded-xl border border-surface-3">
            <h3 className="text-neutral font-medium text-sm mb-3">New Anki Deck</h3>

            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Topic (e.g. Renal physiology, Cardiac arrhythmias)"
              className="w-full bg-surface-3 rounded-lg px-3 py-2.5 text-sm text-neutral placeholder:text-surface-4 outline-none border border-transparent focus:border-brand-primary/50 transition-colors mb-2"
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleGenerate()}
              disabled={generating}
            />

            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Additional context or notes (optional) — paste lecture notes here"
              rows={3}
              className="w-full bg-surface-3 rounded-lg px-3 py-2.5 text-sm text-neutral placeholder:text-surface-4 outline-none border border-transparent focus:border-brand-primary/50 transition-colors resize-none mb-3"
              disabled={generating}
            />

            {/* File + search toggles */}
            <div className="flex items-center gap-2 mb-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={generating || uploading}
                title="Attach PDF or TXT"
                className={[
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50",
                  attachedFile
                    ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/30"
                    : "bg-surface-3 text-surface-4 hover:text-neutral border border-transparent",
                ].join(" ")}
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                {uploading ? "Uploading..." : "Attach file"}
              </button>

              <button
                onClick={() => setUseSearch(s => !s)}
                disabled={generating}
                title="Search the web for latest info on this topic"
                className={[
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50",
                  useSearch
                    ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/30"
                    : "bg-surface-3 text-surface-4 hover:text-neutral border border-transparent",
                ].join(" ")}
              >
                <Search size={12} />
                Web search
              </button>
            </div>

            {/* Attached file badge */}
            {attachedFile && (
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center gap-1.5 px-2 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded-md text-[11px] text-brand-primary font-medium max-w-xs truncate">
                  <FileText size={10} className="flex-shrink-0" />
                  {attachedFile}
                </span>
                <button
                  onClick={() => setAttachedFile(null)}
                  className="text-surface-4 hover:text-accent-error transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {uploadError && <p className="text-accent-error text-xs mb-3">{uploadError}</p>}
            {genError && <p className="text-accent-error text-xs mb-3">{genError}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || generating || uploading}
                className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-sm text-white font-medium transition-colors"
              >
                {generating && <Loader2 size={14} className="animate-spin" />}
                {generating ? "Generating..." : "Generate 15-20 Cards"}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-surface-3 hover:bg-surface-2 rounded-md text-sm text-surface-4 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {decks.length === 0 && !showNew && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BookOpen size={36} className="text-surface-3 mb-3" strokeWidth={1} />
            <p className="text-surface-4 text-sm">No decks yet.</p>
            <p className="text-surface-4 text-xs mt-1">Click Generate Deck to create your first one.</p>
          </div>
        )}

        {/* Deck list */}
        <div className="flex flex-col gap-2">
          {decks.map(deck => (
            <button
              key={deck.id}
              onClick={() => openDeck(deck)}
              disabled={loadingDeckId === deck.id}
              className="flex items-center gap-4 p-4 bg-surface-2 hover:bg-surface-3 rounded-xl text-left transition-colors group disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                {loadingDeckId === deck.id
                  ? <Loader2 size={18} className="text-brand-primary animate-spin" />
                  : <BookOpen size={18} className="text-brand-primary" strokeWidth={1.5} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-neutral text-sm font-medium truncate">{deck.title}</div>
                <div className="text-surface-4 text-[12px] mt-0.5">
                  {deck.card_count} cards · {new Date(deck.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={e => handleDelete(e, deck.id)}
                className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded hover:bg-accent-error/20 transition-all"
                title="Delete deck"
              >
                <Trash2 size={14} className="text-surface-4 hover:text-accent-error" />
              </button>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
