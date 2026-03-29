"use client"
import { useState } from "react"
import { IconRail } from "@/components/sidebar/IconRail"
import { ChatListPanel } from "@/components/sidebar/ChatListPanel"
import { TutorialModal } from "@/components/tutorial/TutorialModal"
import { useTutorial } from "@/components/tutorial/useTutorial"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { open: tutorialOpen, dismiss: dismissTutorial } = useTutorial()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-0">
      {/* Icon rail — always visible, always on top */}
      <IconRail onMenuClick={() => setSidebarOpen(s => !s)} />

      {/* Desktop spacer — keeps main content from going under the fixed panel */}
      <div className="hidden md:block w-64 flex-shrink-0" />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Panel — always fixed, slides on mobile, always visible on desktop */}
      <ChatListPanel isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 min-w-0 flex flex-col bg-surface-1 overflow-hidden">
        {children}
      </main>

      <TutorialModal open={tutorialOpen} onClose={dismissTutorial} />
    </div>
  )
}
