import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authClient } from './auth-client'

interface AuthContextType {
  user: { id: string; email: string; name?: string } | null
  isLoading: boolean
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string; name?: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data } = await authClient.getSession()
        if (data?.user) {
          setUser({ id: data.user.id, email: data.user.email, name: data.user.name || undefined })
        }
      } catch {
        // no session
      } finally {
        setIsLoading(false)
      }
    }
    loadSession()
  }, [])

  const refreshSession = async () => {
    try {
      const { data } = await authClient.getSession()
      if (data?.user) {
        setUser({ id: data.user.id, email: data.user.email, name: data.user.name || undefined })
      } else {
        setUser(null)
      }
    } catch {
      // keep current state on error
    }
  }

  const logout = async () => {
    await authClient.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
