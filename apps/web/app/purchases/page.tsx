"use client"

import { useEffect, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, FileCode2, Upload } from "lucide-react"

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

const fmt = (n: number) => `$ ${n.toLocaleString("es-CL")}`

const TYPE_LABEL: Record<number, string> = {
  33: "Factura",
  39: "Boleta",
  46: "F. Compra",
  61: "N. Crédito",
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; tone: "error" | "ok" } | null>(null)
  const [xmlLoading, setXmlLoading] = useState(false)
  const [xmlFile, setXmlFile] = useState<File | null>(null)

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
        setMessage({ text: "Error al cargar compras", tone: "error" })
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
      setMessage({ text: "Compra registrada correctamente", tone: "ok" })
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
      setMessage({ text: err.error || "Error al registrar compra", tone: "error" })
    }
    setSaving(false)
  }

  const handleXmlUpload = async () => {
    if (!xmlFile) return
    setXmlLoading(true)
    setMessage(null)

    const reader = new FileReader()
    reader.readAsText(xmlFile)
    reader.onload = async () => {
      const xmlContent = reader.result as string
      const res = await fetch("/api/purchases/import-xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xmlContent }),
      })

      if (res.ok) {
        setMessage({ text: "Compra importada desde XML correctamente", tone: "ok" })
        setXmlFile(null)
        fetchPurchases()
      } else {
        const err = await res.json().catch(() => ({}))
        setMessage({ text: err.error || "Error al importar XML", tone: "error" })
      }
      setXmlLoading(false)
    }
    reader.onerror = () => {
      setMessage({ text: "Error al leer el archivo XML", tone: "error" })
      setXmlLoading(false)
    }
  }

  const totals = purchases.reduce(
    (acc, p) => ({
      neto: acc.neto + p.netAmount,
      iva: acc.iva + p.taxAmount,
      total: acc.total + p.totalAmount,
    }),
    { neto: 0, iva: 0, total: 0 }
  )

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Masthead */}
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Compras · Registro</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              {purchases.length} documentos
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            Facturas{" "}
            <em className="text-primary not-italic font-medium">recibidas</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Registra compras manualmente o importa el XML del DTE recibido. El IVA crédito y los asientos se generan automáticamente.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Registrar compra
        </Button>
      </section>

      {message && (
        <div
          className={`rounded-sm border px-4 py-2 text-xs ${
            message.tone === "error"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-sage/30 bg-sage/5 text-sage"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* XML import block */}
      <section className="card-editorial p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileCode2 className="h-4 w-4 text-primary" />
          <span className="eyebrow">Importar desde XML</span>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="flex-1 flex items-center gap-3 cursor-pointer group">
            <span className="inline-flex h-9 items-center justify-center rounded-sm border border-input bg-card px-3 text-xs font-medium hover:bg-secondary transition-colors">
              <Upload className="mr-1.5 h-3 w-3" />
              Seleccionar archivo
            </span>
            <input
              type="file"
              accept=".xml"
              onChange={(e) => setXmlFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <span className="text-xs text-muted-foreground">
              {xmlFile ? xmlFile.name : "Ningún archivo seleccionado"}
            </span>
          </label>
          <Button
            variant="outline"
            onClick={handleXmlUpload}
            disabled={!xmlFile || xmlLoading}
          >
            {xmlLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            Importar XML
          </Button>
        </div>
        <p className="text-xs text-muted-foreground/70 mt-3">
          Sube un archivo XML de DTE recibido (factura electrónica de proveedor) para registrar la compra automáticamente.
        </p>
      </section>

      {/* Historial */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <span className="eyebrow block mb-1">I · Historial</span>
            <h3 className="font-display text-2xl font-semibold tracking-tightest">
              Compras registradas
            </h3>
          </div>
          {purchases.length > 0 && (
            <span className="text-xs text-muted-foreground/60 font-mono tabular">
              Neto {fmt(totals.neto)} · IVA {fmt(totals.iva)}
            </span>
          )}
        </div>

        <div className="card-editorial overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : purchases.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-display text-lg text-muted-foreground mb-1">
                Sin compras registradas
              </p>
              <p className="text-xs text-muted-foreground/70">
                Registra la primera con &ldquo;Registrar compra&rdquo; o importa un XML.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-editorial">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th data-numeric="true">Folio</th>
                    <th>Emisor</th>
                    <th data-numeric="true">Neto</th>
                    <th data-numeric="true">IVA</th>
                    <th data-numeric="true">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id}>
                      <td className="text-muted-foreground">
                        {new Date(p.date).toLocaleDateString("es-CL")}
                      </td>
                      <td>
                        <span className="text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm bg-secondary px-1.5 py-0.5">
                          {TYPE_LABEL[p.type] ?? p.type}
                        </span>
                      </td>
                      <td data-numeric="true">{p.folio}</td>
                      <td>
                        <div className="text-foreground">{p.issuerName}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {p.issuerRut}
                        </div>
                      </td>
                      <td data-numeric="true">{fmt(p.netAmount)}</td>
                      <td data-numeric="true" className="text-muted-foreground">
                        {fmt(p.taxAmount)}
                      </td>
                      <td data-numeric="true" className="font-semibold">
                        {fmt(p.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="text-right font-semibold">
                      Totales
                    </td>
                    <td data-numeric="true" className="font-semibold">{fmt(totals.neto)}</td>
                    <td data-numeric="true" className="font-semibold">{fmt(totals.iva)}</td>
                    <td data-numeric="true" className="font-bold">{fmt(totals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Form modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        eyebrow="Compras · Registro manual"
        title="Nueva compra"
        description="Registra una factura recibida de proveedor. El IVA crédito se calcula y contabiliza automáticamente."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar compra
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Tipo documento</label>
              <select
                className="mt-1 h-10 w-full px-3 py-2 text-sm"
                value={form.type}
                onChange={(e) => handleChange("type", Number(e.target.value))}
              >
                <option value={33}>33 — Factura Electrónica</option>
                <option value={39}>39 — Boleta Electrónica</option>
                <option value={46}>46 — Factura de Compra</option>
                <option value={61}>61 — Nota de Crédito</option>
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
                placeholder="Ej: oficina, servicios, inventario"
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
              <label className="text-sm font-medium">IVA (19 %)</label>
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
        </div>
      </Modal>
    </div>
  )
}
