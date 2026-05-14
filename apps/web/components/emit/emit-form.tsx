"use client"

import { useState, useMemo, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { EmitDocumentSchema, calcularIVA, calcularTotal } from "@contachile/validators"
import { useEmitDocument, useEmitBridgeDocument } from "@/hooks/use-emit-document"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2, Trash2, Plus, Send, Building2 } from "lucide-react"

const DTE_TYPES = [
  { value: 33, label: "33 - Factura Electrónica", desc: "Venta de bienes o servicios" },
  { value: 34, label: "34 - Factura Exenta", desc: "Operaciones no afectas a IVA" },
  { value: 39, label: "39 - Boleta Electrónica", desc: "Venta a consumidor final" },
  { value: 41, label: "41 - Boleta Exenta", desc: "Operaciones exentas a consumidor final" },
  { value: 43, label: "43 - Liquidación-Factura", desc: "Compra de productos agrícolas" },
  { value: 46, label: "46 - Factura de Compra", desc: "Compra a no obligados a facturar" },
  { value: 52, label: "52 - Guía de Despacho", desc: "Traslado de mercaderías" },
  { value: 56, label: "56 - Nota de Débito", desc: "Aumento en el valor de una factura" },
  { value: 61, label: "61 - Nota de Crédito", desc: "Disminución o anulación de una factura" },
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

export function EmitForm() {
  const [mode, setMode] = useState<"direct" | "bridge">("direct")
  const emitDirect = useEmitDocument()
  const emitBridge = useEmitBridgeDocument()
  const router = useRouter()

  const form = useForm({
    resolver: zodResolver(EmitDocumentSchema),
    defaultValues: {
      type: 33,
      receiver: { rut: "", name: "", address: "" },
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
      paymentMethod: "CONTADO",
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
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Mode selector */}
      <div className="flex items-center space-x-4">
        <Button
          type="button"
          variant={mode === "direct" ? "default" : "outline"}
          onClick={() => setMode("direct")}
          className="flex-1"
        >
          <Send className="mr-2 h-4 w-4" />
          Emisión Directa
        </Button>
        <Button
          type="button"
          variant={mode === "bridge" ? "default" : "outline"}
          onClick={() => setMode("bridge")}
          className="flex-1"
        >
          <Building2 className="mr-2 h-4 w-4" />
          Bridge (Acepta)
        </Button>
      </div>

      {/* Document type */}
      <Card>
        <CardHeader>
          <CardTitle>Tipo de Documento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DTE_TYPES.map((type) => (
              <label
                key={type.value}
                className={`flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  currentType === type.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={type.value}
                  checked={currentType === type.value}
                  onChange={() => form.setValue("type", type.value, { shouldValidate: true })}
                  className="sr-only"
                />
                <span className="font-medium text-sm">{type.label}</span>
                <span className="text-xs text-muted-foreground mt-1">{type.desc}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Receiver */}
      <Card>
        <CardHeader>
          <CardTitle>Receptor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">RUT</label>
              <Input
                {...form.register("receiver.rut")}
                placeholder="76.123.456-7"
                onBlur={handleRutBlur}
                className={form.formState.errors.receiver?.rut ? "border-destructive" : ""}
              />
              {form.formState.errors.receiver?.rut && (
                <div className="flex items-center mt-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {form.formState.errors.receiver.rut.message}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Nombre / Razón Social</label>
              <Input
                {...form.register("receiver.name")}
                placeholder="Razón social"
                className={form.formState.errors.receiver?.name ? "border-destructive" : ""}
              />
              {form.formState.errors.receiver?.name && (
                <div className="flex items-center mt-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {form.formState.errors.receiver.name.message}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Dirección</label>
            <Input {...form.register("receiver.address")} placeholder="Dirección completa" />
          </div>
          <div>
            <label className="text-sm font-medium">Email (opcional)</label>
            <Input {...form.register("receiver.email" as never)} placeholder="receptor@empresa.cl" type="email" />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-3 items-end p-3 rounded-lg border bg-muted/30">
              <div className="col-span-12 md:col-span-5">
                <label className="text-sm font-medium">Descripción</label>
                <Input
                  {...form.register(`items.${index}.description`)}
                  placeholder="Producto o servicio"
                />
              </div>
              <div className="col-span-4 md:col-span-2">
                <label className="text-sm font-medium">Cant.</label>
                <Input
                  type="number"
                  {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                />
              </div>
              <div className="col-span-5 md:col-span-3">
                <label className="text-sm font-medium">Precio unitario</label>
                <Input
                  type="number"
                  {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                />
              </div>
              <div className="col-span-3 md:col-span-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  className="w-full"
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
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar item
          </Button>
        </CardContent>
      </Card>

      {/* Payment method */}
      <div className="flex items-center space-x-4">
        <div className="w-full md:w-auto">
          <label className="text-sm font-medium">Método de pago</label>
          <select
            {...form.register("paymentMethod")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </select>
        </div>
      </div>

      {/* Totals */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>Totales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Neto</span>
            <span className="font-medium">${totals.neto.toLocaleString("es-CL")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">IVA (19%)</span>
            <span className="font-medium">${totals.tax.toLocaleString("es-CL")}</span>
          </div>
          <div className="border-t pt-2 flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>${totals.total.toLocaleString("es-CL")}</span>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button type="submit" disabled={isPending} className="w-full md:w-auto">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Emitiendo...
          </>
        ) : mode === "direct" ? (
          "Emitir DTE"
        ) : (
          "Emitir vía Acepta"
        )}
      </Button>

      {isSuccess && (
        <div className="flex items-center p-4 rounded-lg bg-green-50 text-green-700">
          <CheckCircle2 className="h-5 w-5 mr-2" />
          <p className="text-sm">
            Documento emitido correctamente. Folio: {successData?.folio ?? "N/A"}
          </p>
        </div>
      )}
      {isError && (
        <div className="flex items-center p-4 rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="h-5 w-5 mr-2" />
          <p className="text-sm">
            Error al emitir: {error?.message}
          </p>
        </div>
      )}
    </form>
  )
}
