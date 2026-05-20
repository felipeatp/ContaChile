const API_BASE = 'http://192.168.1.100:3001' // Cambiar por la IP del servidor en desarrollo

let apiKey: string | null = null

export function setApiKey(key: string) {
  apiKey = key
}

export function getApiKey(): string | null {
  return apiKey
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  if (!apiKey) throw new Error('API key no configurada')

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  return res.json()
}
