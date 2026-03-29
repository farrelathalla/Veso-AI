"use client"
import { useState, useEffect } from "react"

const STORAGE_KEY = "veso_tutorial_done"

export function useTutorial() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    // Show tutorial on first visit
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true)
    }
    // Listen for manual trigger from any child component
    const handler = () => setOpen(true)
    window.addEventListener("veso:open-tutorial", handler)
    return () => window.removeEventListener("veso:open-tutorial", handler)
  }, [])

  const dismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1")
    }
    setOpen(false)
  }

  return { open, dismiss }
}
