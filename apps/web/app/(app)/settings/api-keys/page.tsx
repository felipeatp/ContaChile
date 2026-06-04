"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Key, Copy, Trash2, Eye, EyeOff } from "lucide-react"

interface ApiKey {
  id: string
  name: string
  scopes: string[]
  lastUsedAt: string | null
  revoked: boolean
  createdAt: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKey, setNewKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/api-keys")
      .then((res) => res.json())
      .then((data) => {
        setKeys(data.keys || [])
        setLoading(false)
      })
      .catch(() => {
        setMessage("Error al cargar API keys")
        setLoading(false)
      })
  }, [])

  const createKey = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    setMessage(null)
    setNewKey(null)

    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    })

    const data = await res.json()
    if (res.ok) {
      setNewKey(data.key)
      setKeys((prev) => [data, ...prev])
      setNewKeyName("")
    } else {
      setMessage(data.error || "Error al crear API key")
    }
    setCreating(false)
  }

  const revokeKey = async (id: string) => {
    const res = await fetch(`/api/api-keys?id=${id}`, { method: "DELETE" })
    if (res.ok) {
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked: true } : k)))
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setMessage("Copiado al portapapeles")
    setTimeout(() => setMessage(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-3xl animate-fade-up">
      <section>
        <span className="eyebrow">Integraciones · API Pública</span>
        <h2 className="font-display text-3xl font-semibold tracking-tightest mt-1">
          API Keys
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Genera keys para que sistemas externos accedan a tus datos de forma segura.
        </p>
      </section>

      {message && (
        <div className={`rounded-sm border px-3 py-2 text-xs ${message.includes("Error") ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-sage/30 bg-sage/5 text-sage"}`}>
          {message}
        </div>
      )}

      <div className="card-editorial p-6 space-y-4">
        <h3 className="font-display text-lg font-semibold">Nueva API Key</h3>
        <div className="flex gap-3">
          <Input
            placeholder="Nombre descriptivo (ej: Integración Shopify)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1"
          />
          <Button onClick={createKey} disabled={creating || !newKeyName.trim()}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generar
          </Button>
        </div>

        {newKey && (
          <div className="rounded-sm bg-amber-50 border border-amber-200 p-3 space-y-2">
            <p className="text-xs text-amber-800 font-medium">
              Guarda esta key ahora. No podrás verla de nuevo.
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-white border rounded px-2 py-1 flex-1 break-all font-mono">{newKey}</code>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(newKey)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="card-editorial p-6 space-y-4">
        <h3 className="font-display text-lg font-semibold">Tus API Keys</h3>
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tienes API keys generadas.</p>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between p-3 border rounded-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{key.name}</span>
                    {key.revoked ? (
                      <Badge variant="destructive">Revocada</Badge>
                    ) : (
                      <Badge variant="outline">Activa</Badge>
                    )}
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>{key.scopes.join(", ")}</span>
                    <span>·</span>
                    <span>Creada {new Date(key.createdAt).toLocaleDateString("es-CL")}</span>
                    {key.lastUsedAt && (
                      <>
                        <span>·</span>
                        <span>Último uso {new Date(key.lastUsedAt).toLocaleDateString("es-CL")}</span>
                      </>
                    )}
                  </div>
                </div>
                {!key.revoked && (
                  <Button size="sm" variant="ghost" onClick={() => revokeKey(key.id)} aria-label="Revocar API key">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-editorial p-6 space-y-3">
        <h3 className="font-display text-lg font-semibold">Documentación rápida</h3>
        <p className="text-sm text-muted-foreground">
          Incluye la key en el header <code className="text-xs bg-secondary px-1 rounded">x-api-key</code> de cada petición.
        </p>
        <pre className="text-xs bg-secondary p-3 rounded-sm overflow-x-auto">
{`curl https://api.ContAI.cl/public/v1/documents \\
  -H "x-api-key: ck_live_..."`}
        </pre>
        <p className="text-xs text-muted-foreground">
          Endpoints disponibles: <code className="bg-secondary px-1 rounded">GET /public/v1/company</code>,{" "}
          <code className="bg-secondary px-1 rounded">GET /public/v1/documents</code>,{" "}
          <code className="bg-secondary px-1 rounded">GET /public/v1/purchases</code>,{" "}
          <code className="bg-secondary px-1 rounded">GET /public/v1/accounting/reports</code>
        </p>
      </div>
    </div>
  )
}
