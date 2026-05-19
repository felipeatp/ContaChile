"use client"

import dynamic from "next/dynamic"
import { SidebarContador } from "@/components/layout/sidebar-contador"
import { Header } from "@/components/layout/header"

const ChatWidget = dynamic(
  () => import("@/components/ai/chat-widget").then((m) => m.ChatWidget),
  { ssr: false }
)
import { useSidebarState } from "@/components/layout/sidebar-state-provider"
import { cn } from "@/lib/utils"

export default function ContadorLayout({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarState()

  return (
    <div className="theme-contador min-h-screen">
      <SidebarContador />
      <div
        className={cn(
          "transition-[padding] duration-300",
          collapsed ? "lg:pl-16" : "lg:pl-64"
        )}
      >
        <Header />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-paper focus:border focus:border-foreground focus:rounded-sm"
        >
          Saltar al contenido
        </a>
        <main id="main-content" className="container py-6">
          {children}
        </main>
      </div>
      <ChatWidget />
    </div>
  )
}
