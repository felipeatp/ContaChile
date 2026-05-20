import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'
import { setApiKey } from './api'

interface AuthContextType {
  apiKey: string | null
  isLoading: boolean
  login: (key: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const API_KEY_STORAGE = 'contachile_api_key'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    SecureStore.getItemAsync(API_KEY_STORAGE).then((key) => {
      if (key) {
        setKey(key)
        setApiKey(key)
      }
      setIsLoading(false)
    })
  }, [])

  const login = async (key: string) => {
    await SecureStore.setItemAsync(API_KEY_STORAGE, key)
    setKey(key)
    setApiKey(key)
  }

  const logout = async () => {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE)
    setKey(null)
    setApiKey('')
  }

  return (
    <AuthContext.Provider value={{ apiKey, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
