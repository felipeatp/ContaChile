"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react"

type SidebarState = {
  collapsed: boolean
  mobileOpen: boolean
  toggleCollapsed: () => void
  setCollapsed: (v: boolean) => void
  setMobileOpen: (v: boolean) => void
}

const SidebarContext = createContext<SidebarState | null>(null)

const STORAGE_KEY = "cc:sidebar:collapsed"

export function SidebarStateProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === "true") setCollapsedState(true)
    } catch {
      // localStorage no disponible (private mode, etc)
    }
    setHydrated(true)
  }, [])

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v)
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "true" : "false")
    } catch {
      // ignore
    }
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!collapsed)
  }, [collapsed, setCollapsed])

  return (
    <SidebarContext.Provider
      value={{
        collapsed: hydrated ? collapsed : false,
        mobileOpen,
        toggleCollapsed,
        setCollapsed,
        setMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarState(): SidebarState {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error("useSidebarState must be used inside <SidebarStateProvider>")
  }
  return ctx
}
