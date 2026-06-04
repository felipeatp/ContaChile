"use client"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { formatCLP } from "@contachile/validators"

const DTE_TYPE_LABELS: Record<number, string> = {
  33: "Factura electrónica",
  34: "Factura exenta",
  39: "Boleta electrónica",
  41: "Boleta exenta",
  43: "Liquidación-Factura",
  46: "Factura de compra",
  52: "Guía de despacho",
  56: "Nota de débito",
  61: "Nota de crédito",
}

export interface PreviewData {
  type: number
  receiver: { rut: string; name: string; address?: string; commune?: string; city?: string }
  items: Array<{ description: string; quantity: number; unitPrice: number }>
  totals: { neto: number; tax: number; total: number }
  paymentMethod: string
  mode: "direct" | "bridge"
}

interface EmitPreviewModalProps {
  open: boolean
  data: PreviewData
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function EmitPreviewModal({
  open,
  data,
  isPending,
  onConfirm,
  onCancel,
}: EmitPreviewModalProps) {
  const typeLabel = DTE_TYPE_LABELS[data.type] ?? `Tipo ${data.type}`
  const paymentLabel = data.paymentMethod === "CREDITO" ? "Crédito" : "Contado"

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="md"
      eyebrow="Confirmar emisión"
      title="¿Emitir este documento?"
      description="Revisa los datos antes de enviarlo al SII. Una vez emitido, solo puedes anularlo con una nota de crédito."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Emitiendo…
              </>
            ) : (
              data.mode === "bridge" ? "Confirmar y emitir vía Acepta" : "Confirmar y emitir"
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {/* Tipo y método */}
        <div className="flex gap-6">
          <div>
            <p className="eyebrow !text-[0.6rem] mb-0.5">Tipo</p>
            <p className="font-medium">{typeLabel}</p>
          </div>
          <div>
            <p className="eyebrow !text-[0.6rem] mb-0.5">Pago</p>
            <p className="font-medium">{paymentLabel}</p>
          </div>
        </div>

        {/* Receptor */}
        <div className="rounded-sm border border-border bg-secondary/20 px-3 py-2.5 space-y-0.5">
          <p className="eyebrow !text-[0.6rem] mb-1">Receptor</p>
          <p className="font-mono font-medium">{data.receiver.rut}</p>
          <p className="text-foreground">{data.receiver.name}</p>
          {data.receiver.address && (
            <p className="text-muted-foreground text-xs">
              {data.receiver.address}
              {data.receiver.commune ? `, ${data.receiver.commune}` : ''}
            </p>
          )}
        </div>

        {/* Items */}
        <div>
          <p className="eyebrow !text-[0.6rem] mb-1.5">Detalle</p>
          <div className="space-y-1">
            {data.items.map((item, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground truncate flex-1">{item.description || "Sin descripción"}</span>
                <span className="font-mono shrink-0">{item.quantity} × {formatCLP(item.unitPrice)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totales */}
        <div className="rounded-sm border border-border bg-paper px-3 py-2.5 space-y-1.5">
          <div className="flex justify-between text-muted-foreground">
            <span>Neto</span>
            <span className="font-mono">{formatCLP(data.totals.neto)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>IVA 19%</span>
            <span className="font-mono">{formatCLP(data.totals.tax)}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="font-mono text-base">{formatCLP(data.totals.total)}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
