"use client"
import { useEffect, useRef, useState } from "react"
import { X, ChevronRight, ChevronLeft } from "lucide-react"

interface Step {
  title: string
  description: string
  target?: string // data-tutorial attribute value
}

const STEPS: Step[] = [
  {
    title: "Welcome to Veso AI",
    description:
      "Your AI-powered medical study companion. Let's take a quick tour so you know how to get the most out of it.",
  },
  {
    title: "Ask medical questions",
    description:
      "Type any medical question — anatomy, pharmacology, pathology, clinical cases — and get detailed, exam-focused answers. Shift+Enter for a new line, Enter to send.",
  },
  {
    title: "Generate Anki cards",
    description:
      "Click the book icon to enter Anki mode. Type a topic like 'Cardiac arrhythmias' and send. Veso AI will generate 15-25 high-yield flashcards with varying difficulty. You can also generate cards from the Anki page.",
    target: "anki-toggle",
  },
  {
    title: "Search the web",
    description:
      "Click the search icon to enable web search. Your question will be answered using live web results — great for recent guidelines or journal articles. For research papers, try including 'study' or 'journal' in your query.",
    target: "search-toggle",
  },
  {
    title: "Upload study materials",
    description:
      "Click the paperclip icon to upload a PDF or TXT file. Once uploaded, ask questions about it or generate Anki cards from its content. The AI uses only that file to answer.",
    target: "file-upload",
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function TutorialModal({ open, onClose }: Props) {
  const [step, setStep] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const current = STEPS[step]

  useEffect(() => {
    if (!open) return
    setStep(0)
    setSpotlightRect(null)
  }, [open])

  useEffect(() => {
    if (!open || !current.target) {
      setSpotlightRect(null)
      return
    }
    // Small delay to allow layout to settle
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-tutorial="${current.target}"]`)
      if (el) {
        setSpotlightRect(el.getBoundingClientRect())
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [open, step, current.target])

  if (!open) return null

  const isFirst = step === 0
  const isLast = step === STEPS.length - 1
  const PAD = 10 // spotlight padding around element

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Dark overlay */}
      <div ref={overlayRef} className="absolute inset-0 bg-black/60" />

      {/* Spotlight cutout — only shown when we have a target rect */}
      {spotlightRect && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: spotlightRect.top - PAD,
            left: spotlightRect.left - PAD,
            width: spotlightRect.width + PAD * 2,
            height: spotlightRect.height + PAD * 2,
            borderRadius: 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            zIndex: 51,
          }}
        />
      )}

      {/* Arrow pointing to the target (if spotlit) */}
      {spotlightRect && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: spotlightRect.bottom + PAD + 8,
            left: spotlightRect.left + spotlightRect.width / 2 - 8,
            zIndex: 52,
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderBottom: "10px solid #10A37F",
            }}
          />
        </div>
      )}

      {/* Modal card */}
      <div
        className="relative bg-surface-1 rounded-2xl border border-surface-2 shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
        style={{ zIndex: 53 }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-surface-4 hover:text-neutral transition-colors"
        >
          <X size={16} />
        </button>

        {/* Step counter dots */}
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={[
                "h-1 rounded-full transition-all duration-300",
                i === step ? "bg-brand-primary flex-1" : "bg-surface-3 w-4",
              ].join(" ")}
            />
          ))}
        </div>

        {/* Content */}
        <div>
          <h2 className="text-neutral font-semibold text-base mb-2">{current.title}</h2>
          <p className="text-surface-4 text-sm leading-relaxed">{current.description}</p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-[12px] text-surface-4 hover:text-neutral transition-colors"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-neutral transition-colors"
              >
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            <button
              onClick={isLast ? onClose : () => setStep(s => s + 1)}
              className="flex items-center gap-1 px-4 py-1.5 bg-brand-primary hover:bg-brand-primary/90 rounded-lg text-sm text-white transition-colors"
            >
              {isLast ? "Done" : "Next"}
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
