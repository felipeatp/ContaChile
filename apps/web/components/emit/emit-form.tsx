"use client"

import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { EmitDocumentSchema } from "@contachile/validators"
import { useEmitDocument } from "@/hooks/use-emit-document"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function EmitForm() {
  const [mode, setMode] = useState<"direct" | "bridge">("direct")
  const emit = useEmitDocument()
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

  const onSubmit = form.handleSubmit(async (data) => {
    const idempotencyKey = crypto.randomUUID()
    await emit.mutateAsync({ body: data, idempotencyKey })
    form.reset()
  })

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
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Dirección</label>
            <Input {...form.register("receiver.address")} placeholder="Dirección completa" />
          </div>
          <div>
            <label className="text-sm font-medium">Email (opcional)</label>
            <Input {...form.register("receiver.email" as never)} placeholder="receptor@empresa.cl" />
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

      <Button type="submit" disabled={emit.isPending}>
        {emit.isPending ? "Emitiendo..." : "Emitir DTE"}
      </Button>

      {emit.isSuccess && (
        <p className="text-sm text-green-600">
          Documento emitido correctamente. Folio: {emit.data.folio}
        </p>
      )}
      {emit.isError && (
        <p className="text-sm text-destructive">
          Error al emitir: {emit.error.message}
        </p>
      )}
    </form>
  )
}
