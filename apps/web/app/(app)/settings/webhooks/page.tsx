"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Webhook, Trash2, CheckCircle2, XCircle } from "lucide-react"

interface WebhookItem {
  id: string
  url: string
  events: string[]
  active: boolean
  createdAt: string
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [url, setUrl] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/webhooks")
      .then((res) => res.json())
      .then((data) => {
        setWebhooks(data.webhooks || [])
        setLoading(false)
      })
      .catch(() => {
        setMessage("Error al cargar webhooks")
        setLoading(false)
      })
  }, [])

  const createWebhook = async () => {
    if (!url.trim()) return
    setCreating(true)
    setMessage(null)

    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })

    const data = await res.json()
    if (res.ok) {
      setWebhooks((prev) => [data.webhook, ...prev])
      setUrl("")
    } else {
      setMessage(data.error || "Error al crear webhook")
    }
    setCreating(false)
  }

  const toggleWebhook = async (id: string, active: boolean) => {
    const res = await fetch(`/api/webhooks?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    })
    if (res.ok) {
      setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, active } : w)))
    }
  }

  const deleteWebhook = async (id: string) => {
    const res = await fetch(`/api/webhooks?id=${id}`, { method: "DELETE" })
    if (res.ok) {
      setWebhooks((prev) => prev.filter((w) => w.id !== id))
    }
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
        <span className="eyebrow">Integraciones · Webhooks</span>
        <h2 className="font-display text-3xl font-semibold tracking-tightest mt-1">
          Webhooks
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Recibe notificaciones en tiempo real cuando ocurran eventos en tu empresa.
        </p>
      </section>

      {message && (
        <div className={`rounded-sm border px-3 py-2 text-xs ${message.includes("Error") ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-sage/30 bg-sage/5 text-sage"}`}>
          {message}
        </div>
      )}

      <div className="card-editorial p-6 space-y-4">
        <h3 className="font-display text-lg font-semibold">Nuevo webhook</h3>
        <div className="flex gap-3">
          <Input
            placeholder="https://tu-sistema.cl/webhook/contachile"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
          />
          <Button onClick={createWebhook} disabled={creating || !url.trim()}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear
          </Button>
        </div>
      </div>

      <div className="card-editorial p-6 space-y-4">
        <h3 className="font-display text-lg font-semibold">Tus webhooks</h3>
        {webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tienes webhooks configurados.</p>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div key={wh.id} className="flex items-center justify-between p-3 border rounded-sm">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm truncate">{wh.url}</span>
                    {wh.active ? (
                      <Badge variant="outline" className="shrink-0"><CheckCircle2 className="h-3 w-3 mr-1" />Activo</Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0"><XCircle className="h-3 w-3 mr-1" />Inactivo</Badge>
                    )}
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                    {wh.events.map((e) => (
                      <code key={e} className="bg-secondary px-1 rounded">{e}</code>
                    ))}
                    <span>· Creado {new Date(wh.createdAt).toLocaleDateString("es-CL")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggleWebhook(wh.id, !wh.active)}>
                    {wh.active ? "Pausar" : "Activar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteWebhook(wh.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-editorial p-6 space-y-3">
        <h3 className="font-display text-lg font-semibold">Formato de payload</h3>
        <p className="text-sm text-muted-foreground">
          Cada evento se envía como POST con firma HMAC-SHA256 en el header <code className="text-xs bg-secondary px-1 rounded">X-Webhook-Signature</code>.
        </p>
        <pre className="text-xs bg-secondary p-3 rounded-sm overflow-x-auto">
{`{
  "event": "document.created",
  "data": { ... },
  "timestamp": "2026-05-19T12:00:00.000Z"
}`}
        </pre>
      </div>
    </div>
  )
}
