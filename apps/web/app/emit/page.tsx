import { EmitForm } from "@/components/emit/emit-form"

export default function EmitPage() {
  return (
    <div className="space-y-8 animate-fade-up">
      <section className="max-w-2xl">
        <div className="flex items-center gap-3 mb-3">
          <span className="eyebrow">Ventas · Emisión</span>
          <span className="h-px w-10 bg-foreground/20" />
          <span className="eyebrow text-muted-foreground/60">Factura · Boleta · Nota</span>
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
          Emitir{' '}
          <em className="text-primary not-italic font-medium">documento tributario</em>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Folio asignado en la generación, XML firmado y enviado al SII. Boleta queda visible al cliente vía email.
        </p>
      </section>

      <EmitForm />
    </div>
  )
}
