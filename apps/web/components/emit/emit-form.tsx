"use client"

import { useState, useMemo } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { EmitDocumentSchema, calcularIVA, calcularTotal } from "@contachile/validators"
import { useEmitDocument, useEmitBridgeDocument } from "@/hooks/use-emit-document"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

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

  const onSubmit = form.handleSubmit(async (data) => {
    const idempotencyKey = crypto.randomUUID()
    const emit = mode === "direct" ? emitDirect : emitBridge
    await emit.mutateAsync({ body: data, idempotencyKey })
    form.reset()
    setTimeout(() => router.push("/documents"), 1500)
  })

  const isPending = emitDirect.isPending || emitBridge.isPending
  const isSuccess = emitDirect.isSuccess || emitBridge.isSuccess
  const isError = emitDirect.isError || emitBridge.isError
  const error = emitDirect.error || emitBridge.error
  const successData = emitDirect.data || emitBridge.data

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button
          type="button"
          variant={mode === "direct" ? "default" : "outline"}
          onClick={() => setMode("direct")}
        >
          Emisión Directa
        </Button>
        <Button
          type="button"
          variant={mode === "bridge" ? "default" : "outline"}
          onClick={() => setMode("bridge")}
        >
          Bridge (Acepta)
        </Button>
      </div>

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
              />
              {form.formState.errors.receiver?.rut && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.receiver.rut.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input {...form.register("receiver.name")} placeholder="Razón social" />
              {form.formState.errors.receiver?.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.receiver.name.message}
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Dirección</label>
            <Input {...form.register("receiver.address")} placeholder="Dirección completa" />
          </div>
          <div>
            <label className="text-sm font-medium">Email (opcional)</label>
            <Input {...form.register("receiver.email")} placeholder="receptor@empresa.cl" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-6">
                <label className="text-sm font-medium">Descripción</label>
                <Input
                  {...form.register(`items.${index}.description`)}
                  placeholder="Producto o servicio"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Cantidad</label>
                <Input
                  type="number"
                  {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                />
              </div>
              <div className="col-span-3">
                <label className="text-sm font-medium">Precio unitario</label>
                <Input
                  type="number"
                  {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                />
              </div>
              <div className="col-span-1">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                >
                  X
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}
          >
            + Agregar item
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center space-x-4">
        <div>
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

      <Card>
        <CardHeader>
          <CardTitle>Totales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Neto</span>
            <span>${totals.neto.toLocaleString("es-CL")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">IVA (19%)</span>
            <span>${totals.tax.toLocaleString("es-CL")}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>${totals.total.toLocaleString("es-CL")}</span>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Emitiendo..." : mode === "direct" ? "Emitir DTE" : "Emitir vía Acepta"}
      </Button>

      {isSuccess && (
        <p className="text-sm text-green-600">
          Documento emitido correctamente. Folio: {successData?.folio ?? "N/A"}
        </p>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          Error al emitir: {error?.message}
        </p>
      )}
    </form>
  )
}
