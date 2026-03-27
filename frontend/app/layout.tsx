import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "next-auth/react"

const inter = Inter({ subsets: ["latin"] })

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10A37F",
}

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Veso AI — Medical Student Assistant",
    template: "%s | Veso AI",
  },
  description:
    "AI-powered study companion for medical students. Ask medical questions, generate Anki flashcards, upload study materials, and get evidence-based answers for USMLE, PLAB, and more.",
  keywords: [
    "medical student",
    "USMLE",
    "PLAB",
    "Anki flashcards",
    "medical AI",
    "study assistant",
    "medical chatbot",
    "flashcard generator",
  ],
  authors: [{ name: "Veso AI" }],
  creator: "Veso AI",
  applicationName: "Veso AI",
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Veso AI",
    title: "Veso AI — Medical Student Assistant",
    description:
      "AI-powered study companion for medical students. Ask questions, generate Anki flashcards, upload study materials, and get evidence-based answers.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Veso AI — Medical Student Assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Veso AI — Medical Student Assistant",
    description:
      "AI-powered study companion for medical students. Ask questions, generate Anki flashcards, and get evidence-based answers.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [
      {
        rel: "mask-icon",
        url: "/favicon.ico",
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-surface-0`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
