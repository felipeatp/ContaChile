"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, ShoppingCart } from "lucide-react"

interface Purchase {
  id: string
  type: number
  folio: number
  issuerRut: string
  issuerName: string
  date: string
  netAmount: number
  taxAmount: number
  totalAmount: number
  category: string | null
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [form, setForm] = useState({
    type: 33,
    folio: "",
    issuerRut: "",
    issuerName: "",
    date: new Date().toISOString().split("T")[0],
    netAmount: "",
    taxAmount: "",
    totalAmount: "",
    category: "",
  })

  const fetchPurchases = () => {
    setLoading(true)
    fetch("/api/purchases")
      .then((res) => res.json())
      .then((data) => {
        setPurchases(data.purchases || [])
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        setMessage("Error al cargar compras")
      })
  }

  useEffect(() => {
    fetchPurchases()
  }, [])

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    setSaving(true)
    setMessage(null)

    const payload = {
      type: Number(form.type),
      folio: Number(form.folio),
      issuerRut: form.issuerRut,
      issuerName: form.issuerName,
      date: form.date,
      netAmount: Number(form.netAmount),
      taxAmount: Number(form.taxAmount),
      totalAmount: Number(form.totalAmount),
      category: form.category || undefined,
    }

    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      setMessage("Compra registrada correctamente")
      setShowForm(false)
      setForm({
        type: 33,
        folio: "",
        issuerRut: "",
        issuerName: "",
        date: new Date().toISOString().split("T")[0],
        netAmount: "",
        taxAmount: "",
        totalAmount: "",
        category: "",
      })
      fetchPurchases()
    } else {
      const err = await res.json().catch(() => ({}))
      setMessage(err.error || "Error al registrar compra")
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compras</h1>
          <p className="text-muted-foreground">Registra las facturas recibidas de tus proveedores</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          {showForm ? "Cancelar" : "Registrar compra"}
        </Button>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-2 text-sm ${message.includes("Error") ? "bg-destructive/10 text-destructive" : "bg-green-100 text-green-800"}`}>
          {message}
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ShoppingCart className="mr-2 h-5 w-5" />
              Nueva compra
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tipo documento</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(e) => handleChange("type", Number(e.target.value))}
                >
                  <option value={33}>33 - Factura Electrónica</option>
                  <option value={39}>39 - Boleta Electrónica</option>
                  <option value={46}>46 - Factura de Compra</option>
                  <option value={61}>61 - Nota de Crédito</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Folio</label>
                <Input
                  type="number"
                  placeholder="12345"
                  value={form.folio}
                  onChange={(e) => handleChange("folio", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">RUT Emisor</label>
                <Input
                  placeholder="76.123.456-7"
                  value={form.issuerRut}
                  onChange={(e) => handleChange("issuerRut", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Nombre Emisor</label>
                <Input
                  placeholder="Razón social del proveedor"
                  value={form.issuerName}
                  onChange={(e) => handleChange("issuerName", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Fecha</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => handleChange("date", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Categoría</label>
                <Input
                  placeholder="Ej: Oficina, Servicios, Inventario"
                  value={form.category}
                  onChange={(e) => handleChange("category", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Monto neto</label>
                <Input
                  type="number"
                  placeholder="100000"
                  value={form.netAmount}
                  onChange={(e) => handleChange("netAmount", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">IVA (19%)</label>
                <Input
                  type="number"
                  placeholder="19000"
                  value={form.taxAmount}
                  onChange={(e) => handleChange("taxAmount", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Total</label>
                <Input
                  type="number"
                  placeholder="119000"
                  value={form.totalAmount}
                  onChange={(e) => handleChange("totalAmount", e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar compra
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial de compras</CardTitle>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-muted-foreground">No hay compras registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Fecha</th>
                    <th className="text-left py-2 px-2">Tipo</th>
                    <th className="text-left py-2 px-2">Folio</th>
                    <th className="text-left py-2 px-2">Emisor</th>
                    <th className="text-right py-2 px-2">Neto</th>
                    <th className="text-right py-2 px-2">IVA</th>
                    <th className="text-right py-2 px-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 px-2">{new Date(p.date).toLocaleDateString("es-CL")}</td>
                      <td className="py-2 px-2">{p.type}</td>
                      <td className="py-2 px-2">{p.folio}</td>
                      <td className="py-2 px-2">{p.issuerName}</td>
                      <td className="py-2 px-2 text-right">${p.netAmount.toLocaleString("es-CL")}</td>
                      <td className="py-2 px-2 text-right">${p.taxAmount.toLocaleString("es-CL")}</td>
                      <td className="py-2 px-2 text-right">${p.totalAmount.toLocaleString("es-CL")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
