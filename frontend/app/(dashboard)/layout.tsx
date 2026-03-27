import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { IconRail } from "@/components/sidebar/IconRail"
import { ChatListPanel } from "@/components/sidebar/ChatListPanel"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-0">
      <IconRail />
      <ChatListPanel />
      <main className="flex-1 min-w-0 flex flex-col bg-surface-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
