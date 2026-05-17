"use client"

import { useState, useMemo, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { EmitDocumentSchema, calcularIVA, calcularTotal } from "@contachile/validators"
import { useEmitDocument, useEmitBridgeDocument } from "@/hooks/use-emit-document"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Field } from "@/components/ui/field"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2, Trash2, Plus, Send, Building2 } from "lucide-react"

const DTE_TYPES = [
  { value: 33, label: "Factura electrónica", desc: "Venta de bienes o servicios" },
  { value: 34, label: "Factura exenta", desc: "Operaciones no afectas a IVA" },
  { value: 39, label: "Boleta electrónica", desc: "Venta a consumidor final" },
  { value: 41, label: "Boleta exenta", desc: "Operaciones exentas a consumidor final" },
  { value: 43, label: "Liquidación-Factura", desc: "Compra de productos agrícolas" },
  { value: 46, label: "Factura de compra", desc: "Compra a no obligados a facturar" },
  { value: 52, label: "Guía de despacho", desc: "Traslado de mercaderías" },
  { value: 56, label: "Nota de débito", desc: "Aumento en el valor de una factura" },
  { value: 61, label: "Nota de crédito", desc: "Disminución o anulación de una factura" },
]

function formatRUT(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, "")
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1).toUpperCase()
  let formatted = ""
  let count = 0
  for (let i = body.length - 1; i >= 0; i--) {
    formatted = body[i] + formatted
    count++
    if (count === 3 && i > 0) {
      formatted = "." + formatted
      count = 0
    }
  }
  return formatted + "-" + dv
}

const fmt = (n: number) => `$ ${n.toLocaleString("es-CL")}`

export function EmitForm() {
  const [mode, setMode] = useState<"direct" | "bridge">("direct")
  const emitDirect = useEmitDocument()
  const emitBridge = useEmitBridgeDocument()
  const router = useRouter()
  const searchParams = useSearchParams()
  const creditNoteId = searchParams.get("creditNote")
  const duplicateId = searchParams.get("duplicate")

  const [receiverSuggestions, setReceiverSuggestions] = useState<Array<{ rut: string; name: string; email: string | null }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const form = useForm({
    resolver: zodResolver(EmitDocumentSchema),
    defaultValues: {
      type: 33,
      receiver: { rut: "", name: "", address: "", commune: "", city: "" },
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
      paymentMethod: "CONTADO",
      references: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const items = form.watch("items")
  const rutValue = form.watch("receiver.rut")
  const currentType = form.watch("type")

  const totals = useMemo(() => {
    const neto = items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0
      const price = Number(item.unitPrice) || 0
      return sum + qty * price
    }, 0)
    const tax = calcularIVA(neto)
    const total = calcularTotal(neto)
    return { neto, tax, total }
  }, [items])

  useEffect(() => {
    if (creditNoteId) {
      fetch(`/api/documents/${creditNoteId}`)
        .then((res) => res.json())
        .then((doc) => {
          if (doc) {
            form.setValue("type", 61, { shouldValidate: true })
            form.setValue("receiver.rut", doc.receiverRut || "")
            form.setValue("receiver.name", doc.receiverName || "")
            form.setValue("receiver.address", doc.receiverAddress || "")
            form.setValue("receiver.commune", doc.receiverCommune || "")
            form.setValue("receiver.city", doc.receiverCity || "")
            form.setValue("references" as any, [
              {
                type: doc.type,
                folio: doc.folio,
                date: doc.emittedAt ? doc.emittedAt.split("T")[0] : new Date().toISOString().split("T")[0],
                reason: "Anulación",
              },
            ] as any)
            if (doc.items && doc.items.length > 0) {
              form.setValue(
                "items",
                doc.items.map((item: any) => ({
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                }))
              )
            }
          }
        })
        .catch(() => {})
    }
  }, [creditNoteId, form])

  useEffect(() => {
    if (duplicateId) {
      fetch(`/api/documents/${duplicateId}`)
        .then((res) => res.json())
        .then((doc) => {
          if (doc) {
            form.setValue("type", doc.type, { shouldValidate: true })
            form.setValue("receiver.rut", doc.receiverRut || "")
            form.setValue("receiver.name", doc.receiverName || "")
            form.setValue("receiver.address", doc.receiverAddress || "")
            form.setValue("receiver.commune", doc.receiverCommune || "")
            form.setValue("receiver.city", doc.receiverCity || "")
            form.setValue("paymentMethod", doc.paymentMethod || "CONTADO")
            if (doc.items && doc.items.length > 0) {
              form.setValue(
                "items",
                doc.items.map((item: any) => ({
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                }))
              )
            }
          }
        })
        .catch(() => {})
    }
  }, [duplicateId, form])

  useEffect(() => {
    const rawRut = rutValue?.replace(/[^0-9kK]/g, "") ?? ""
    if (rawRut.length < 3) {
      setReceiverSuggestions([])
      setShowSuggestions(false)
      return
    }

    const timer = setTimeout(() => {
      setSuggestionsLoading(true)
      fetch(`/api/receivers?search=${encodeURIComponent(rawRut)}`)
        .then((res) => res.json())
        .then((json) => {
          const list = json?.receivers ?? []
          setReceiverSuggestions(list)
          setShowSuggestions(list.length > 0)
        })
        .catch(() => {
          setReceiverSuggestions([])
          setShowSuggestions(false)
        })
        .finally(() => setSuggestionsLoading(false))
    }, 300)

    return () => clearTimeout(timer)
  }, [rutValue])

  const onSubmit = form.handleSubmit((data) => {
    const idempotencyKey = crypto.randomUUID()
    const emit = mode === "direct" ? emitDirect : emitBridge
    emit.mutate({ body: data, idempotencyKey })
  })

  const isPending = emitDirect.isPending || emitBridge.isPending
  const isSuccess = emitDirect.isSuccess || emitBridge.isSuccess
  const isError = emitDirect.isError || emitBridge.isError
  const error = emitDirect.error || emitBridge.error
  const successData = emitDirect.data || emitBridge.data

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        form.reset()
        router.push("/documents")
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [isSuccess, form, router])

  const handleRutBlur = () => {
    if (rutValue) {
      const formatted = formatRUT(rutValue)
      form.setValue("receiver.rut", formatted)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="card-editorial p-1 flex">
        <ModeTab
          active={mode === "direct"}
          onClick={() => setMode("direct")}
          icon={<Send className="h-4 w-4" />}
          label="Emisión directa"
        />
        <ModeTab
          active={mode === "bridge"}
          onClick={() => setMode("bridge")}
          icon={<Building2 className="h-4 w-4" />}
          label="Bridge · Acepta"
        />
      </div>

      <Section eyebrow="I · Tipo de documento" title="¿Qué emites?">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {DTE_TYPES.map((type) => {
            const selected = currentType === type.value
            return (
              <label
                key={type.value}
                className={`group cursor-pointer rounded-sm border p-3 transition-all ${
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={type.value}
                  checked={selected}
                  onChange={() => form.setValue("type", type.value, { shouldValidate: true })}
                  className="sr-only"
                />
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className={`eyebrow ${selected ? "!text-primary" : ""}`}>
                    Tipo {type.value}
                  </span>
                  {selected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                </div>
                <p className="font-display text-sm font-semibold tracking-tight">{type.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{type.desc}</p>
              </label>
            )
          })}
        </div>
      </Section>

      <Section eyebrow="II · Receptor" title="Cliente del documento">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="RUT" error={form.formState.errors.receiver?.rut?.message as string | undefined}>
            <div className="relative">
              <Input
                {...form.register("receiver.rut")}
                placeholder="76.123.456-7"
                onBlur={handleRutBlur}
                onFocus={() => (rutValue?.length ?? 0) >= 3 && receiverSuggestions.length > 0 && setShowSuggestions(true)}
                className={form.formState.errors.receiver?.rut ? "border-destructive" : ""}
              />
              {suggestionsLoading && (
                <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {showSuggestions && receiverSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-sm border border-border bg-card shadow-lg">
                  {receiverSuggestions.map((s) => (
                    <button
                      key={s.rut}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors first:rounded-t-sm last:rounded-b-sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        form.setValue("receiver.rut", formatRUT(s.rut), { shouldValidate: true })
                        form.setValue("receiver.name", s.name || "", { shouldValidate: true })
                        if (s.email) {
                          form.setValue("receiver.email" as never, s.email as never)
                        }
                        setShowSuggestions(false)
                      }}
                    >
                      <span className="font-mono text-xs font-medium">{formatRUT(s.rut)}</span>
                      <span className="text-muted-foreground ml-2">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
          <Field label="Razón social" error={form.formState.errors.receiver?.name?.message as string | undefined}>
            <Input
              {...form.register("receiver.name")}
              placeholder="Razón social"
              className={form.formState.errors.receiver?.name ? "border-destructive" : ""}
            />
          </Field>
          <Field label="Dirección">
            <Input {...form.register("receiver.address")} placeholder="Dirección completa" />
          </Field>
          <Field label="Comuna">
            <Input {...form.register("receiver.commune")} placeholder="Santiago" />
          </Field>
          <Field label="Ciudad">
            <Input {...form.register("receiver.city")} placeholder="Santiago" />
          </Field>
          <Field label="Email" hint="opcional">
            <Input {...form.register("receiver.email" as never)} placeholder="receptor@empresa.cl" type="email" />
          </Field>
        </div>
      </Section>

      <Section eyebrow="III · Items" title="Detalle del documento">
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-3 items-end rounded-sm border border-border/60 bg-secondary/30 p-3">
              <div className="col-span-12 md:col-span-6">
                <Field label="Descripción">
                  <Input
                    {...form.register(`items.${index}.description`)}
                    placeholder="Producto o servicio"
                  />
                </Field>
              </div>
              <div className="col-span-4 md:col-span-2">
                <Field label="Cantidad">
                  <Input
                    type="number"
                    {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                  />
                </Field>
              </div>
              <div className="col-span-5 md:col-span-3">
                <Field label="Precio unitario">
                  <Input
                    type="number"
                    {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                  />
                </Field>
              </div>
              <div className="col-span-3 md:col-span-1 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar item
          </Button>
        </div>
      </Section>

      <Section eyebrow="IV · Pago y totales" title="Forma y monto">
        <div className="grid gap-6 md:grid-cols-2 items-start">
          <Field label="Método de pago">
            <Select {...form.register("paymentMethod")}>
              <option value="CONTADO">Contado</option>
              <option value="CREDITO">Crédito</option>
            </Select>
          </Field>

          <div className="card-editorial p-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Neto</span>
              <span className="font-mono tabular-nums text-sm">{fmt(totals.neto)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">IVA · 19 %</span>
              <span className="font-mono tabular-nums text-sm">{fmt(totals.tax)}</span>
            </div>
            <div className="h-px bg-border/60" />
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Total</span>
              <span className="stat-figure text-2xl">{fmt(totals.total)}</span>
            </div>
          </div>
        </div>
      </Section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Emitiendo…
            </>
          ) : mode === "direct" ? (
            "Emitir DTE"
          ) : (
            "Emitir vía Acepta"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          El folio se asigna en la generación. El XML se firma con tu certificado y se envía al SII.
        </p>
      </div>

      {isSuccess && (
        <div className="flex items-center gap-3 rounded-sm border border-sage/30 bg-sage/5 p-4 text-sage">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-sm">
            Documento emitido. Folio:{' '}
            <span className="font-mono font-semibold">{successData?.folio ?? "N/A"}</span>
          </p>
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-3 rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">Error al emitir: {error?.message}</p>
        </div>
      )}
    </form>
  )
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div>
        <span className="eyebrow block mb-1">{eyebrow}</span>
        <h3 className="font-display text-xl font-semibold tracking-tightest">{title}</h3>
      </div>
      {children}
    </section>
  )
}
