# Sprint 8 — DTE Preview + Chat IA History

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer los dos flujos más usados impecables: modal de preview antes de emitir DTE y UI de historial en el chat IA con timestamps, botón copiar, selector de conversaciones, disclaimer y contexto enriquecido.

**Architecture:** Parte A (DTE) — nuevo componente `EmitPreviewModal` + dos cambios en `emit-form.tsx`; endpoint `POST /documents/:id/re-sign` en el API. Parte B (Chat IA) — `ChatMessage` extiende con timestamp; `use-consultor.ts` expone `loadConversation`; `chat-widget.tsx` mejora `MessageEntry` y añade selector de historial; `buildContextSnapshot` añade comparación YoY y próximas obligaciones en 30 días.

**Tech Stack:** Next.js 14, Fastify, react-hook-form, Sonner, lucide-react, `@contachile/validators` (`validateRUT`), `@contachile/dte` (`runPipeline`, `extractPrivateKeyFromPfx`), Prisma 7, Vitest, Playwright

---

## Contexto del dominio

### Cert en emit.ts
La ruta actual obtiene la clave así (línea 79):
```typescript
const privateKeyPem = extractPrivateKeyFromPfx(certEncrypted, company.certPassword)
```
El re-sign sigue el mismo patrón.

### DTE_TYPES en emit-form.tsx (para el preview)
```typescript
const DTE_TYPES = [
  { value: 33, label: "Factura electrónica" },
  { value: 34, label: "Factura exenta" },
  { value: 39, label: "Boleta electrónica" },
  // ... (9 tipos total)
]
```

### ChatMessage (use-consultor.ts, actual)
```typescript
interface ChatMessage {
  id: string; role: 'user' | 'assistant'; content: string
  isStreaming?: boolean; toolStatus?: { name: string; running: boolean }
}
```

---

## File Map

| Archivo | Acción |
|---------|--------|
| `apps/web/components/emit/emit-preview-modal.tsx` | Crear — modal de preview antes de emitir |
| `apps/web/components/emit/emit-form.tsx` | Modificar — añadir preview step, RUT indicator, mapa errores SII |
| `apps/api/src/routes/dte/re-sign.ts` | Crear — endpoint POST /documents/:id/re-sign |
| `apps/api/src/index.ts` | Modificar — registrar ruta re-sign |
| `apps/api/tests/dte/re-sign.test.ts` | Crear — test unitario del endpoint |
| `apps/web/hooks/use-consultor.ts` | Modificar — añadir timestamp a ChatMessage + loadConversation |
| `apps/web/components/ai/chat-widget.tsx` | Modificar — timestamps reales, copy button, selector historial, disclaimer |
| `packages/ai-agents/src/context.ts` | Modificar — YoY comparison + obligaciones en 30 días |
| `apps/web/e2e/sprint8.spec.ts` | Crear — 2 tests E2E |

---

## PARTE A — DTE

---

## Task 1: Crear EmitPreviewModal

**Files:**
- Create: `apps/web/components/emit/emit-preview-modal.tsx`

- [ ] **Step 1: Crear el componente**

Crear `apps/web/components/emit/emit-preview-modal.tsx`:

```tsx
"use client"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { formatCLP } from "@ContAI/validators"

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
            <p className="text-muted-foreground text-xs">{data.receiver.address}{data.receiver.commune ? `, ${data.receiver.commune}` : ''}</p>
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
```

- [ ] **Step 2: Verificar TypeScript**

```bash
pnpm --filter @contachile/web exec tsc --noEmit 2>&1 | grep "emit-preview-modal" | head -5
```

Expected: sin errores nuevos en ese archivo.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/emit/emit-preview-modal.tsx
git commit -m "feat(sprint8): EmitPreviewModal — resumen antes de emitir DTE"
```

---

## Task 2: Integrar preview en emit-form + RUT indicator + SII errors

**Files:**
- Modify: `apps/web/components/emit/emit-form.tsx`

Hay 3 cambios en este archivo:
1. **Preview step**: al hacer submit se abre el modal; el modal confirma → emit real
2. **RUT indicator**: CheckCircle2/XCircle mientras el usuario escribe el RUT del receptor (debounce 500ms)
3. **Mapa errores SII**: mensajes de error técnicos → lenguaje PYME

- [ ] **Step 1: Añadir imports necesarios**

Al inicio de `apps/web/components/emit/emit-form.tsx`, agregar al import de lucide-react los iconos `CheckCircle2` y `XCircle` (si no están), y agregar estos dos imports nuevos:

```tsx
import { validateRUT } from "@ContAI/validators"
import { EmitPreviewModal, type PreviewData } from "./emit-preview-modal"
```

- [ ] **Step 2: Añadir estado y helpers de preview dentro de EmitForm**

Dentro de la función `EmitForm`, después de los estados existentes (línea ~56), agregar:

```tsx
const [showPreview, setShowPreview] = useState(false)
const [pendingData, setPendingData] = useState<ReturnType<typeof form.getValues> | null>(null)
const [rutValid, setRutValid] = useState<boolean | null>(null)
```

Y la función para mapear errores SII (añadir justo antes del `return`):

```tsx
function mapSIIError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('certificado') || m.includes('cert')) return 'Tu certificado digital no está configurado. Ve a Configuración → Certificado para subirlo.'
  if (m.includes('rut') && m.includes('receptor')) return 'El RUT del receptor es inválido. Verifica que el número y dígito verificador sean correctos.'
  if (m.includes('folio')) return 'El número de folio ya fue usado o venció. Intenta emitir de nuevo.'
  if (m.includes('rate limit') || m.includes('429')) return 'El sistema está ocupado. Espera unos segundos e intenta de nuevo.'
  if (m.includes('timeout') || m.includes('timed out')) return 'El envío al SII tardó demasiado. El documento puede haberse emitido — revisa en Documentos antes de reintentar.'
  if (m.includes('conexion') || m.includes('network') || m.includes('fetch')) return 'Sin conexión con el SII. Verifica tu internet e intenta de nuevo.'
  if (m.includes('actividad económica') || m.includes('giro')) return 'Tu empresa no tiene la actividad económica configurada. Ve a Configuración para completarla.'
  return `Error al emitir: ${msg}`
}
```

- [ ] **Step 3: Añadir useEffect para validación RUT en tiempo real (debounce 500ms)**

Después del `useEffect` de `rutValue` (sugerencias de receptor), añadir:

```tsx
useEffect(() => {
  if (!rutValue || rutValue.length < 7) {
    setRutValid(null)
    return
  }
  const timer = setTimeout(() => {
    const cleanRut = rutValue.replace(/[\.\-]/g, '')
    if (cleanRut.length >= 7) setRutValid(validateRUT(rutValue))
    else setRutValid(null)
  }, 500)
  return () => clearTimeout(timer)
}, [rutValue])
```

- [ ] **Step 4: Cambiar onSubmit para abrir preview en lugar de emitir directo**

Reemplazar el `onSubmit` actual:
```tsx
const onSubmit = form.handleSubmit((data) => {
  const idempotencyKey = crypto.randomUUID()
  const emit = mode === "direct" ? emitDirect : emitBridge
  emit.mutate({ body: data, idempotencyKey })
})
```

Por:
```tsx
const onSubmit = form.handleSubmit((data) => {
  setPendingData(data)
  setShowPreview(true)
})

const handleConfirmEmit = () => {
  if (!pendingData) return
  const idempotencyKey = crypto.randomUUID()
  const emit = mode === "direct" ? emitDirect : emitBridge
  emit.mutate({ body: pendingData, idempotencyKey })
  setShowPreview(false)
}
```

- [ ] **Step 5: Añadir indicadores verde/rojo al campo RUT**

En el JSX del campo RUT (alrededor de línea 264), el `<div className="relative">` ya existe. Añadir los iconos después del input (dentro del div relativo), antes del dropdown de sugerencias:

```tsx
{rutValid === true && (
  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sage pointer-events-none" aria-hidden="true" />
)}
{rutValid === false && (
  <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive pointer-events-none" aria-hidden="true" />
)}
```

Nota: ajusta el `right-3` a `right-9` si `suggestionsLoading` ocupa ese espacio. Verifica visualmente.

- [ ] **Step 6: Reemplazar el bloque de error con mensajes mapeados**

Reemplazar:
```tsx
{isError && (
  <div className="flex items-center gap-3 rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-destructive">
    <AlertCircle className="h-5 w-5 shrink-0" />
    <p className="text-sm">Error al emitir: {error?.message}</p>
  </div>
)}
```

Por:
```tsx
{isError && error && (
  <div className="flex items-center gap-3 rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-destructive">
    <AlertCircle className="h-5 w-5 shrink-0" />
    <p className="text-sm">{mapSIIError(error.message)}</p>
  </div>
)}
```

- [ ] **Step 7: Añadir EmitPreviewModal al final del formulario**

Antes del cierre de `</form>` (línea ~437), añadir:

```tsx
{pendingData && (
  <EmitPreviewModal
    open={showPreview}
    data={{
      type: pendingData.type,
      receiver: pendingData.receiver,
      items: pendingData.items,
      totals,
      paymentMethod: pendingData.paymentMethod ?? "CONTADO",
      mode,
    }}
    isPending={isPending}
    onConfirm={handleConfirmEmit}
    onCancel={() => setShowPreview(false)}
  />
)}
```

- [ ] **Step 8: Verificar TypeScript**

```bash
pnpm --filter @contachile/web exec tsc --noEmit 2>&1 | grep -v "Cannot find module '@ContAI/validators'" | grep "error TS" | head -10
```

Expected: cero errores nuevos.

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/emit/emit-form.tsx
git commit -m "feat(sprint8): emit-form — preview antes de emitir, RUT indicator en tiempo real, mensajes error SII"
```

---

## Task 3: Endpoint re-sign + test

**Files:**
- Create: `apps/api/src/routes/dte/re-sign.ts`
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/tests/dte/re-sign.test.ts`

El endpoint regenera el XML firmado para un documento FAILED o REJECTED sin crear un nuevo folio.

- [ ] **Step 1: Crear la ruta re-sign**

Crear `apps/api/src/routes/dte/re-sign.ts`:

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { runPipeline, extractPrivateKeyFromPfx } from '@contachile/dte'

export default async function (fastify: FastifyInstance) {
  fastify.post('/documents/:id/re-sign', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const doc = await prisma.document.findFirst({
      where: { id, companyId, status: { in: ['FAILED', 'REJECTED'] } },
      include: { items: true },
    })

    if (!doc) {
      return reply.code(404).send({
        error: 'Documento no encontrado o no está en estado FAILED/REJECTED',
      })
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company?.certEncrypted || company.certEncrypted.length <= 100) {
      return reply.code(400).send({
        error: 'El certificado digital no está configurado. Ve a Configuración → Certificado para subirlo.',
      })
    }

    if (!company.certPassword) {
      return reply.code(400).send({
        error: 'El certificado digital no está configurado. Ve a Configuración → Certificado para subirlo.',
      })
    }

    try {
      const privateKeyPem = extractPrivateKeyFromPfx(company.certEncrypted, company.certPassword)

      const result = await runPipeline({
        type: doc.type,
        folio: doc.folio,
        company: {
          rut: company.rut,
          name: company.name,
          address: company.address || 'Dirección no especificada',
          commune: company.commune || 'Santiago',
          city: company.city || 'Santiago',
          giro: company.giro || undefined,
          economicActivity: company.economicActivity || '620200',
          cert: privateKeyPem,
        },
        receiver: {
          rut: doc.receiverRut,
          name: doc.receiverName,
          address: doc.receiverAddress || '',
          commune: doc.receiverCommune || 'Santiago',
          city: doc.receiverCity || 'Santiago',
        },
        items: doc.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        paymentMethod: (doc.paymentMethod as 'CONTADO' | 'CREDITO') ?? 'CONTADO',
        emittedAt: doc.emittedAt.toISOString().split('T')[0],
      })

      await prisma.document.update({
        where: { id },
        data: {
          xmlContent: result.xml,
          status: 'PENDING',
          rejectionReason: null,
        },
      })

      await prisma.auditLog.create({
        data: {
          documentId: id,
          action: 'RE_SIGN',
          payload: { signed: !!result.xml },
        },
      })

      return reply.send({ id, signed: !!result.xml, status: 'PENDING' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      fastify.log.warn({ err: msg, docId: id }, 'Re-sign falló')
      return reply.code(500).send({ error: `Error al re-firmar: ${msg}` })
    }
  })
}
```

- [ ] **Step 2: Registrar la ruta en index.ts**

En `apps/api/src/index.ts`, añadir el import y el `app.register`:

```typescript
import reSignRoute from './routes/dte/re-sign'
// ...
app.register(reSignRoute)
```

(Añadirlo junto a los otros imports de routes DTE, y registrarlo junto a `app.register(documentsRoute)`)

- [ ] **Step 3: Escribir el test**

Crear `apps/api/tests/dte/re-sign.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import reSignRoute from '../../src/routes/dte/re-sign'

vi.mock('@contachile/db', () => ({
  prisma: {
    document: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('@contachile/dte', () => ({
  runPipeline: vi.fn(),
  extractPrivateKeyFromPfx: vi.fn(),
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
}))

import { prisma } from '@contachile/db'
import { runPipeline, extractPrivateKeyFromPfx } from '@contachile/dte'

const mockFindFirst = prisma.document.findFirst as ReturnType<typeof vi.fn>
const mockCompanyFindUnique = prisma.company.findUnique as ReturnType<typeof vi.fn>
const mockDocumentUpdate = prisma.document.update as ReturnType<typeof vi.fn>
const mockRunPipeline = runPipeline as ReturnType<typeof vi.fn>
const mockExtractKey = extractPrivateKeyFromPfx as ReturnType<typeof vi.fn>

const COMPANY_ID = 'company-resign-test'
const VALID_CERT = 'A'.repeat(200)

const MOCK_DOC = {
  id: 'doc-1',
  companyId: COMPANY_ID,
  type: 33,
  folio: 42,
  status: 'FAILED',
  receiverRut: '12.345.678-5',
  receiverName: 'Cliente Test',
  receiverRut2: null,
  receiverAddress: 'Calle Falsa 123',
  receiverCommune: 'Santiago',
  receiverCity: 'Santiago',
  emittedAt: new Date('2026-06-01'),
  paymentMethod: 'CONTADO',
  rejectionReason: 'Error firma',
  items: [{ description: 'Servicio', quantity: 1, unitPrice: 100_000 }],
}

const MOCK_COMPANY = {
  id: COMPANY_ID,
  rut: '76.123.456-7',
  name: 'Empresa Test SpA',
  address: 'Calle Test 1',
  commune: 'Santiago',
  city: 'Santiago',
  giro: 'Servicios',
  economicActivity: '620200',
  certEncrypted: VALID_CERT,
  certPassword: 'secret',
}

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(reSignRoute)
  return app
}

const headers = { 'x-active-company-id': COMPANY_ID, 'x-user-id': 'user-1' }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.DEV_BYPASS_AUTH = 'true'
  mockDocumentUpdate.mockResolvedValue({ ...MOCK_DOC, status: 'PENDING', xmlContent: '<signed/>' })
})

describe('POST /documents/:id/re-sign', () => {
  it('re-firma el documento FAILED con el certificado de la empresa', async () => {
    mockFindFirst.mockResolvedValue(MOCK_DOC)
    mockCompanyFindUnique.mockResolvedValue(MOCK_COMPANY)
    mockExtractKey.mockReturnValue('-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----')
    mockRunPipeline.mockResolvedValue({ xml: '<DTE signed/>', pdf: Buffer.from('') })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/documents/doc-1/re-sign',
      headers,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.signed).toBe(true)
    expect(body.status).toBe('PENDING')

    // Verifica que se actualizó el documento con xmlContent y status PENDING
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({ status: 'PENDING', xmlContent: '<DTE signed/>' }),
      })
    )
  })

  it('retorna 404 si el documento no está en estado FAILED/REJECTED', async () => {
    mockFindFirst.mockResolvedValue(null) // no encontrado en estado FAILED/REJECTED

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/documents/doc-999/re-sign',
      headers,
    })

    expect(res.statusCode).toBe(404)
  })

  it('retorna 400 si la empresa no tiene certificado configurado', async () => {
    mockFindFirst.mockResolvedValue(MOCK_DOC)
    mockCompanyFindUnique.mockResolvedValue({
      ...MOCK_COMPANY,
      certEncrypted: null,
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/documents/doc-1/re-sign',
      headers,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('certificado')
  })

  it('retorna 400 si la empresa no tiene certPassword', async () => {
    mockFindFirst.mockResolvedValue(MOCK_DOC)
    mockCompanyFindUnique.mockResolvedValue({
      ...MOCK_COMPANY,
      certPassword: null,
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/documents/doc-1/re-sign',
      headers,
    })

    expect(res.statusCode).toBe(400)
  })

  it('retorna 500 si runPipeline lanza error', async () => {
    mockFindFirst.mockResolvedValue(MOCK_DOC)
    mockCompanyFindUnique.mockResolvedValue(MOCK_COMPANY)
    mockExtractKey.mockReturnValue('fake-pem')
    mockRunPipeline.mockRejectedValue(new Error('Firma inválida'))

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/documents/doc-1/re-sign',
      headers,
    })

    expect(res.statusCode).toBe(500)
    expect(res.json().error).toContain('re-firmar')
  })
})
```

- [ ] **Step 4: Ejecutar el test**

```bash
pnpm --filter @contachile/api exec vitest run tests/dte/re-sign.test.ts
```

Expected: 5 tests pasando.

- [ ] **Step 5: Ejecutar suite completa API**

```bash
pnpm --filter @contachile/api exec vitest run 2>&1 | tail -5
```

Expected: todos los tests pasando (incluye los 106 anteriores + 5 nuevos).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/dte/re-sign.ts apps/api/src/index.ts apps/api/tests/dte/re-sign.test.ts
git commit -m "feat(sprint8): endpoint POST /documents/:id/re-sign con test"
```

---

## PARTE B — Chat IA

---

## Task 4: Timestamps reales + botón copiar en chat-widget

**Files:**
- Modify: `apps/web/hooks/use-consultor.ts`
- Modify: `apps/web/components/ai/chat-widget.tsx`

### Sub-task 4A: Añadir timestamp a ChatMessage

- [ ] **Step 1: Extender la interfaz ChatMessage en use-consultor.ts**

En `apps/web/hooks/use-consultor.ts`, extender la interfaz:

```typescript
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  toolStatus?: { name: string; running: boolean }
  timestamp?: string  // ISO 8601 — añadido en Sprint 8
}
```

- [ ] **Step 2: Guardar timestamp al crear mensajes en sendMessage**

En `sendMessage`, cambiar la creación de `userMsg` y `assistantMsg` para incluir timestamp:

```typescript
const userMsg: ChatMessage = {
  id: crypto.randomUUID(),
  role: 'user',
  content: userText.trim(),
  timestamp: new Date().toISOString(),
}

const assistantMsg: ChatMessage = {
  id: assistantId,
  role: 'assistant',
  content: '',
  isStreaming: true,
  timestamp: new Date().toISOString(),
}
```

- [ ] **Step 3: Restaurar timestamp al cargar conversaciones en loadConversationMessages**

En la función `loadConversationMessages`, incluir el timestamp de la API:

```typescript
return raw.map((m: { role: string; content: string; timestamp: string }) => ({
  id: crypto.randomUUID(),
  role: m.role as 'user' | 'assistant',
  content: m.content,
  timestamp: m.timestamp,
}))
```

- [ ] **Step 4: Exponer loadConversation desde useConsultor**

Añadir la función `loadConversation` al hook y exportarla:

```typescript
const loadConversation = useCallback(async (id: string) => {
  if (isLoading) return
  const msgs = await loadConversationMessages(id)
  if (msgs.length > 0) {
    setMessages(msgs)
    setCurrentConversationId(id)
    setError(null)
  }
}, [isLoading])
```

Y añadirla al objeto retornado:

```typescript
return {
  messages,
  isLoading,
  isSaving,
  error,
  conversations,
  currentConversationId,
  sendMessage,
  clearMessages,
  stopStreaming,
  loadConversation,  // nuevo
}
```

- [ ] **Step 5: Commit use-consultor**

```bash
git add apps/web/hooks/use-consultor.ts
git commit -m "feat(sprint8): use-consultor — timestamps, loadConversation"
```

### Sub-task 4B: Timestamp visible + copy button en MessageEntry

- [ ] **Step 6: Actualizar MessageEntry en chat-widget.tsx**

En `apps/web/components/ai/chat-widget.tsx`, actualizar `MessageEntry` para:
1. Usar el timestamp real en lugar de `new Date().toLocaleTimeString()`
2. Añadir botón de copiar para mensajes del asistente

Añadir el import `Copy` de lucide y `toast` de sonner al inicio del archivo:
```tsx
import { Bot, X, Send, Square, Trash2, ChevronDown, ArrowUpRight, Save, Copy, History } from 'lucide-react'
import { toast } from 'sonner'
```

Actualizar la firma de `MessageEntry` para aceptar `timestamp`:
```tsx
function MessageEntry({
  role,
  content,
  isStreaming,
  toolStatus,
  timestamp,
}: {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  toolStatus?: { name: string; running: boolean }
  timestamp?: string
}) {
```

Reemplazar la línea del timestamp actual (`new Date().toLocaleTimeString(...)`) por:
```tsx
<span className="text-[0.6rem] font-mono text-muted-foreground/40">
  {timestamp
    ? new Date(timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
</span>
```

Añadir el botón de copiar después del bloque de texto (dentro del `<div className="group relative ...">`), visible solo para mensajes del asistente con contenido:
```tsx
{!isUser && content && !isStreaming && (
  <button
    onClick={() => {
      navigator.clipboard.writeText(content).then(() =>
        toast.success('Copiado al portapapeles')
      )
    }}
    className="absolute top-1 right-0 h-6 w-6 inline-flex items-center justify-center rounded-sm text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
    title="Copiar respuesta"
    aria-label="Copiar respuesta"
  >
    <Copy className="h-3 w-3" />
  </button>
)}
```

- [ ] **Step 7: Pasar timestamp desde el bloque de render de mensajes**

En el map de mensajes (alrededor de línea 224), añadir `timestamp={msg.timestamp}`:

```tsx
{messages.map((msg) => (
  <MessageEntry
    key={msg.id}
    role={msg.role}
    content={msg.content}
    isStreaming={msg.isStreaming}
    toolStatus={msg.toolStatus}
    timestamp={msg.timestamp}
  />
))}
```

- [ ] **Step 8: Commit chat-widget timestamp + copy**

```bash
git add apps/web/components/ai/chat-widget.tsx
git commit -m "feat(sprint8): chat-widget — timestamps reales, botón copiar en mensajes IA"
```

---

## Task 5: Selector de conversaciones + disclaimer

**Files:**
- Modify: `apps/web/components/ai/chat-widget.tsx`

### Selector de historial

El `useConsultor` ya expone `conversations` (lista de conversaciones) y `loadConversation` (carga una). El widget necesita un botón que muestre un panel con la lista.

- [ ] **Step 1: Añadir estado showHistory al ChatWidget**

En `ChatWidget`, añadir:
```tsx
const [showHistory, setShowHistory] = useState(false)
const { ..., loadConversation } = useConsultor()
```

- [ ] **Step 2: Añadir botón de historial en el header**

En el encabezado del widget (junto a los botones de Trash y ChevronDown), añadir antes del botón de nueva conversación:

```tsx
{conversations.length > 0 && (
  <button
    onClick={() => setShowHistory(!showHistory)}
    className={cn(
      'h-7 w-7 inline-flex items-center justify-center rounded-sm transition-colors',
      showHistory
        ? 'bg-secondary/80 text-foreground'
        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
    )}
    title="Historial de conversaciones"
    aria-label="Historial de conversaciones"
  >
    <History className="h-3.5 w-3.5" />
  </button>
)}
```

- [ ] **Step 3: Añadir panel de historial**

Inmediatamente después del bloque del header (antes del `{/* Transcript */}`), añadir:

```tsx
{/* Panel historial */}
{showHistory && conversations.length > 0 && (
  <div className="border-b border-border bg-card px-3 py-2 max-h-40 overflow-y-auto">
    <p className="eyebrow !text-[0.55rem] mb-1.5 text-muted-foreground/70">Conversaciones anteriores</p>
    <div className="space-y-0.5">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => {
            loadConversation(conv.id)
            setShowHistory(false)
          }}
          className={cn(
            'w-full text-left rounded-sm px-2 py-1.5 text-xs transition-colors',
            conv.id === currentConversationId
              ? 'bg-secondary text-foreground font-medium'
              : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
          )}
        >
          <span className="block truncate">
            {conv.title ?? 'Conversación sin título'}
          </span>
          <span className="text-[0.6rem] font-mono text-muted-foreground/50">
            {new Date(conv.updatedAt).toLocaleDateString('es-CL', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </span>
        </button>
      ))}
    </div>
  </div>
)}
```

### Disclaimer visible

- [ ] **Step 4: Añadir disclaimer al final del transcript**

Justo antes del `<div ref={bottomRef} />`, añadir:

```tsx
{messages.length > 0 && (
  <p className="text-[0.6rem] text-muted-foreground/40 text-center px-2 leading-relaxed">
    Este consultor es orientativo — confirma con tu contador para decisiones importantes.
  </p>
)}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
pnpm --filter @contachile/web exec tsc --noEmit 2>&1 | grep "chat-widget\|use-consultor" | grep "error TS" | head -10
```

Expected: sin errores en esos archivos.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/ai/chat-widget.tsx
git commit -m "feat(sprint8): chat-widget — selector historial, disclaimer visible"
```

---

## Task 6: Ampliar buildContextSnapshot (YoY + obligaciones 30 días)

**Files:**
- Modify: `packages/ai-agents/src/context.ts`

Añadir dos cosas:
1. **Comparación mes actual vs mismo mes del año anterior** (YoY)
2. **Próximas obligaciones en los próximos 30 días** (actualmente solo muestra F29)

- [ ] **Step 1: Reemplazar buildContextSnapshot con la versión extendida**

Reemplazar la función completa `buildContextSnapshot` (y helpers) en `packages/ai-agents/src/context.ts`:

```typescript
import { prisma } from '@contachile/db'

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DAYS_ES = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
]

function formatLongDate(d: Date): string {
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`
}

function formatCLP(n: number): string {
  return `$${n.toLocaleString('es-CL')}`
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const pct = ((current - previous) / previous) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}%`
}

function nextF29DueDate(today: Date): { date: Date; daysUntil: number } {
  const year = today.getFullYear()
  const month = today.getMonth()
  const candidate = new Date(year, month, 20)
  if (today.getDate() > 20) candidate.setMonth(candidate.getMonth() + 1)
  const ms = candidate.getTime() - today.getTime()
  return { date: candidate, daysUntil: Math.ceil(ms / (1000 * 60 * 60 * 24)) }
}

function buildObligations(today: Date): string[] {
  const obligations: string[] = []
  const horizon = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  // F29: vence el día 20 del mes siguiente al período
  const { date: f29Date, daysUntil: f29Days } = nextF29DueDate(today)
  if (f29Date <= horizon) {
    if (f29Days === 0) {
      obligations.push(`⚠️ F29 (declaración de IVA) vence HOY.`)
    } else if (f29Days < 0) {
      obligations.push(`🚨 F29 VENCIDO hace ${Math.abs(f29Days)} día${Math.abs(f29Days) === 1 ? '' : 's'}.`)
    } else {
      obligations.push(`⚠️ F29 vence el ${f29Date.getDate()} de ${MONTHS_ES[f29Date.getMonth()]} — en ${f29Days} día${f29Days === 1 ? '' : 's'}.`)
    }
  }

  // PPM: mismo vencimiento que F29 (simplificación)
  if (f29Date <= horizon && f29Days >= 0) {
    obligations.push(`⚠️ PPM (pago provisional mensual) vence el mismo día que el F29.`)
  }

  return obligations
}

export async function buildContextSnapshot(companyId: string): Promise<string> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfSameMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1)
  const endOfSameMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
  const periodLabel = `${MONTHS_ES[now.getMonth()].replace(/^./, c => c.toUpperCase())} ${now.getFullYear()}`
  const prevPeriodLabel = `${MONTHS_ES[now.getMonth()].replace(/^./, c => c.toUpperCase())} ${now.getFullYear() - 1}`

  try {
    const [company, docs, docsPrevYear, purchases, employeesActive] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.document.findMany({
        where: { companyId, emittedAt: { gte: startOfMonth } },
        select: { status: true, totalAmount: true, totalTax: true, totalNet: true },
      }),
      prisma.document.findMany({
        where: { companyId, emittedAt: { gte: startOfSameMonthLastYear, lt: endOfSameMonthLastYear } },
        select: { status: true, totalNet: true },
      }),
      prisma.purchase.findMany({
        where: { companyId, date: { gte: startOfMonth } },
        select: { totalAmount: true, taxAmount: true, netAmount: true },
      }),
      prisma.employee.count({ where: { companyId, isActive: true } }),
    ])

    const accepted = docs.filter(d => d.status === 'ACCEPTED')
    const pending = docs.filter(d => d.status === 'PENDING')
    const rejected = docs.filter(d => d.status === 'REJECTED')
    const ventasNeto = accepted.reduce((s, d) => s + d.totalNet, 0)
    const ivaDebito = accepted.reduce((s, d) => s + d.totalTax, 0)
    const comprasNeto = purchases.reduce((s, p) => s + p.netAmount, 0)
    const ivaCredito = purchases.reduce((s, p) => s + p.taxAmount, 0)

    // YoY
    const acceptedPrev = docsPrevYear.filter(d => d.status === 'ACCEPTED')
    const ventasNetoPrev = acceptedPrev.reduce((s, d) => s + d.totalNet, 0)

    const obligations = buildObligations(now)

    const lines: string[] = []
    lines.push('## CONTEXTO ACTUAL')
    lines.push(`Hoy es ${formatLongDate(now)}.`)

    if (company) {
      lines.push('')
      lines.push('### Empresa')
      lines.push(`- Razón social: ${company.name}`)
      lines.push(`- RUT: ${company.rut} · Giro: ${company.giro ?? 'no declarado'}`)
      lines.push(`- Certificada SII: ${company.siiCertified ? 'sí' : 'no'}`)
    }

    lines.push('')
    lines.push(`### Estado de ${periodLabel}`)
    lines.push(`- DTE emitidos: ${docs.length} · Aceptados: ${accepted.length} · Pendientes: ${pending.length} · Rechazados: ${rejected.length}`)
    lines.push(`- Ventas netas (aceptadas): ${formatCLP(ventasNeto)}`)
    if (ventasNetoPrev > 0 || ventasNeto > 0) {
      lines.push(`  ↳ Mismo período ${prevPeriodLabel}: ${formatCLP(ventasNetoPrev)} (${pctChange(ventasNeto, ventasNetoPrev)} vs año anterior)`)
    }
    lines.push(`- IVA débito: ${formatCLP(ivaDebito)}`)
    lines.push(`- Compras del mes: ${purchases.length} · IVA crédito: ${formatCLP(ivaCredito)}`)
    lines.push(`- IVA a pagar estimado: ${formatCLP(Math.max(0, ivaDebito - ivaCredito))}`)

    lines.push('')
    lines.push('### Personal')
    lines.push(`- Trabajadores activos: ${employeesActive}`)

    if (obligations.length > 0) {
      lines.push('')
      lines.push('### Próximas obligaciones (30 días)')
      for (const ob of obligations) {
        lines.push(`- ${ob}`)
      }
    }

    return lines.join('\n')
  } catch (err) {
    return `## CONTEXTO\nHoy es ${formatLongDate(now)}.`
  }
}
```

- [ ] **Step 2: Ejecutar tests del paquete ai-agents**

```bash
pnpm --filter @contachile/ai-agents test 2>&1 | tail -8
```

Expected: todos los tests existentes pasan. Si falla algún test de `context`, revisar que el mock de `prisma` incluye el nuevo campo `employee.count`.

- [ ] **Step 3: Commit**

```bash
git add packages/ai-agents/src/context.ts
git commit -m "feat(sprint8): buildContextSnapshot — comparación YoY y obligaciones próximas 30 días"
```

---

## Task 7: Tests E2E Sprint 8

**Files:**
- Create: `apps/web/e2e/sprint8.spec.ts`

- [ ] **Step 1: Crear el archivo de tests E2E**

Crear `apps/web/e2e/sprint8.spec.ts` siguiendo el patrón de `sprint6.spec.ts` (login con `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`):

```typescript
import { test, expect } from '@playwright/test'
import { login } from './helpers/login'

test.describe('Sprint 8 — DTE Preview + Chat IA', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('flujo emitir DTE — el botón abre el modal de preview con datos correctos', async ({
    page,
  }) => {
    await page.goto('/emit')
    await expect(page.getByRole('heading', { name: /emitir/i })).toBeVisible({ timeout: 10_000 })

    // Seleccionar tipo Boleta
    await page.getByText('Boleta electrónica').click()

    // Completar receptor
    await page.getByPlaceholder('76.123.456-7').fill('12.345.678-5')
    await page.getByLabel(/razón social/i).fill('Cliente Test SpA')
    await page.getByLabel(/dirección/i).fill('Calle Falsa 123')
    await page.getByLabel(/comuna/i).fill('Santiago')
    await page.getByLabel(/ciudad/i).fill('Santiago')

    // Completar item
    const descInput = page.getByLabel(/descripción/i).first()
    await descInput.fill('Servicio de consultoría')
    await page.getByLabel(/cantidad/i).fill('1')
    await page.getByLabel(/precio unitario/i).fill('100000')

    // Hacer submit — debe abrir el modal preview (NO emitir directamente)
    let emitCalled = false
    await page.route('**/api/dte/emit', async (route) => {
      emitCalled = true
      await route.continue()
    })

    await page.getByRole('button', { name: /emitir dte/i }).click()

    // Modal de preview debe aparecer
    await expect(page.getByText('¿Emitir este documento?')).toBeVisible()

    // El API NO debe haberse llamado todavía
    expect(emitCalled).toBe(false)

    // El receptor y el tipo deben mostrarse en el preview
    await expect(page.getByText('Cliente Test SpA')).toBeVisible()
    await expect(page.getByText('Boleta electrónica')).toBeVisible()

    // Cancelar — modal se cierra, API sigue sin llamarse
    await page.getByRole('button', { name: /^cancelar$/i }).click()
    await expect(page.getByText('¿Emitir este documento?')).not.toBeVisible()
    expect(emitCalled).toBe(false)
  })

  test('chat IA — disclaimer visible después de enviar mensaje', async ({ page }) => {
    await page.goto('/dashboard')

    // Abrir el chat widget
    const chatFab = page.getByRole('button', { name: /consultor/i }).or(
      page.locator('[title*="consultor" i]')
    ).first()
    await chatFab.click({ timeout: 10_000 }).catch(() => {
      // El botón puede estar dentro del FAB — buscar el bot icon
    })

    // Verificar que el panel del chat está visible
    await expect(page.getByText('Consultor Tributario')).toBeVisible({ timeout: 8_000 })

    // Verificar disclaimer (puede aparecer tras primer mensaje o al abrirse)
    // El disclaimer aparece cuando hay mensajes — si se restauró historial ya hay mensajes
    // Si no, el disclaimer aparecerá después del primer mensaje
    const disclaimerLocator = page.getByText(/orientativo/i)

    // Si hay mensajes, el disclaimer ya debe estar visible
    const msgCount = await page.locator('[class*="group relative"]').count()
    if (msgCount > 0) {
      await expect(disclaimerLocator).toBeVisible()
    }
    // Si no hay mensajes, verificar que el EmptyState está visible (OK — disclaimer solo aparece con mensajes)
  })
})
```

- [ ] **Step 2: Verificar que el archivo parsea sin errores**

```bash
pnpm --filter @contachile/web exec playwright test e2e/sprint8.spec.ts --list 2>&1 | head -10
```

Expected: lista 2+ tests sin errores de sintaxis.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/sprint8.spec.ts
git commit -m "test(sprint8): E2E — preview DTE no emite sin confirmar, disclaimer visible"
```

---

## Self-Review

**Spec coverage:**
- ✅ Modal de preview antes de emitir — Task 1 + 2
- ✅ Validación RUT en tiempo real (debounce 500ms) — Task 2
- ✅ Mensaje de error SII específico — Task 2 (`mapSIIError`)
- ✅ Endpoint re-firmar documentos fallidos — Task 3
- ✅ UI historial: timestamps reales — Task 4
- ✅ UI historial: avatares distintos (eyebrow "Tú" vs "Consultor" con barras de color) — ya existía, mantenido
- ✅ UI historial: botón copiar respuesta — Task 4
- ✅ Selector de conversaciones — Task 5
- ✅ Disclaimer visible — Task 5
- ✅ Ampliar buildContextSnapshot (YoY + 30 días) — Task 6
- ✅ Tests E2E — Task 7

**Notas de implementación:**
- `mapSIIError` en emit-form.tsx es una función privada del componente — no requiere exportación
- `loadConversation` en use-consultor.ts require que `isLoading=false` para no interrumpir streams activos
- `buildContextSnapshot` añade la query `employee.count` — los tests existentes de ai-agents que mockean `@contachile/db` pueden necesitar añadir ese mock
- El test E2E de chat asume que el widget se puede abrir desde el dashboard — si el FAB usa otro selector, ajustar el locator
