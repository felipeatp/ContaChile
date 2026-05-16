# Cotizaciones — Design Spec (Módulo 6)

## Goal

Implementar el flujo de cotizaciones: crear, enviar, gestionar estados (aceptada/rechazada) y **convertir a factura tipo 33 con un clic** reutilizando el motor DTE existente.

Es la puerta de entrada al ciclo de venta: muchas pymes envían cotización antes de facturar. Sin esto pierden el lead-to-cash flow completo.

## Context

- El proyecto ya tiene motor DTE con `POST /dte/emit` que genera Document tipo 33 con XML firmado.
- Modelo `Document` está acoplado al ciclo SII (folio, trackId, status). Una cotización **no debe ser un Document** porque no es un documento tributario.
- PDF: usar `pdfkit` directamente (ya disponible vía `@contachile/dte` y agregado a `apps/api/package.json`).

## Architecture

### Modelo Prisma

```prisma
enum QuoteStatus {
  DRAFT
  SENT
  ACCEPTED
  REJECTED
  INVOICED
  EXPIRED
}

model Quote {
  id              String      @id @default(cuid())
  companyId       String
  number          Int         // correlativo de cotizaciones por empresa
  date            DateTime    @default(now())
  validUntil      DateTime?
  receiverRut     String
  receiverName    String
  receiverEmail   String?
  receiverAddress String?
  totalNet        Int
  totalTax        Int
  totalAmount     Int
  paymentMethod   String      @default("CONTADO")
  notes           String?
  status          QuoteStatus @default(DRAFT)
  sentAt          DateTime?
  acceptedAt      DateTime?
  rejectedAt      DateTime?
  invoicedAt      DateTime?
  invoicedDocumentId String?  // FK lógica a Document creado al facturar
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  items           QuoteItem[]

  @@unique([companyId, number])
  @@index([companyId, status])
  @@index([date])
}

model QuoteItem {
  id          String @id @default(cuid())
  quoteId     String
  description String
  quantity    Int
  unitPrice   Int
  totalPrice  Int
  quote       Quote  @relation(fields: [quoteId], references: [id], onDelete: Cascade)

  @@index([quoteId])
}
```

### State machine

```
DRAFT ──send──> SENT ──accept──> ACCEPTED ──to-invoice──> INVOICED
                  └──reject──> REJECTED
DRAFT ──send──> SENT (también permite ACCEPTED directo si el cliente firma en persona)
SENT/ACCEPTED ──> EXPIRED (automático si validUntil < hoy, o manual)
```

Transiciones inválidas → 400. Edición permitida solo en DRAFT.

### Endpoints

| Método | Path | Descripción |
|--------|------|-------------|
| GET    | `/quotes?status=&from=&to=` | Lista |
| GET    | `/quotes/:id` | Detalle |
| POST   | `/quotes` | Crear (DRAFT) |
| PATCH  | `/quotes/:id` | Editar (solo DRAFT) |
| DELETE | `/quotes/:id` | Eliminar (solo DRAFT) |
| POST   | `/quotes/:id/send` | DRAFT → SENT (registra sentAt) |
| POST   | `/quotes/:id/accept` | SENT → ACCEPTED |
| POST   | `/quotes/:id/reject` | SENT → REJECTED, body: `{reason?}` |
| POST   | `/quotes/:id/to-invoice` | ACCEPTED → INVOICED, retorna Document creado |
| GET    | `/quotes/:id/pdf` | PDF descargable |

### `POST /quotes/:id/to-invoice`

Reutiliza el pipeline DTE existente. Internamente:
1. Valida que la cotización esté en ACCEPTED
2. Construye el payload `EmitDocumentInput` desde los datos de la cotización (RUT receptor, items, etc.)
3. Hace **fetch interno** o llama al handler directamente al `/dte/emit`
4. Si éxito: actualiza Quote.status=INVOICED, invoicedDocumentId, invoicedAt
5. Retorna `{ document, quote }`

**Simplificación MVP:** en lugar de hacer fetch HTTP interno, extraer la lógica de emit a un helper compartido `emitDteFromInput()`. Pero eso es invasivo. Para MVP, replicar la lógica de creación de Document directamente en este endpoint (sin envío XML para simplificar; el usuario después usa el flujo normal de DTE):

Mejor decisión: **el handler crea un Document en estado PENDING con paymentMethod, items, totals copiados de la cotización**, asigna folio del FolioCounter, llama a `enqueuePollJob` y `createSalesEntry`. Esto reusa exactamente lo que hace `/dte/emit` pero sin pasar por la firma XML (la cotización ya tiene la data, y la firma se gestionará igual que un DTE manual del flujo existente).

Aún más simple: **reusar `prisma.document.create` con la data de la cotización**, igual al patrón de emit pero sin XML firmado. El usuario puede luego "firmar" desde la página de documentos si tiene certificado.

### PDF de cotización

Layout diferente al DTE:
- Encabezado: "COTIZACIÓN" (no es documento tributario)
- Datos empresa
- Datos cliente
- Tabla items: descripción, cantidad, precio, total
- Totales: neto, IVA 19%, total
- Validez (validUntil)
- Notas/condiciones
- "Esta cotización no constituye documento tributario electrónico"
- Pie: firma + sello/lugar opcional

### Validators

```typescript
export const CreateQuoteSchema = z.object({
  number: z.number().int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  receiverRut: z.string().min(8).max(15),
  receiverName: z.string().min(1).max(150),
  receiverEmail: z.string().email().optional(),
  receiverAddress: z.string().max(200).optional(),
  paymentMethod: z.string().max(50).default('CONTADO'),
  notes: z.string().max(500).optional(),
  items: z.array(z.object({
    description: z.string().min(1).max(200),
    quantity: z.number().int().min(1),
    unitPrice: z.number().int().min(0),
  })).min(1),
})

export const UpdateQuoteSchema = CreateQuoteSchema.partial()
```

Totales (`totalNet`, `totalTax`, `totalAmount`) se calculan en el handler usando `calcularIVA`/`calcularTotal` existentes.

## UI

### Página `/ventas/cotizaciones`

- Header: título, botón "Nueva cotización"
- Filtros: estado (Todas/Borrador/Enviada/Aceptada/Rechazada/Facturada), año/mes
- Cards resumen: total cotizado, total aceptado, total facturado del período
- Tabla: número, fecha, cliente, total, estado, acciones (ver detalle, PDF, transición estado, convertir a factura)
- Modal de alta: similar al de emisión DTE pero más simple (sin selector de tipo, sin firma)
- Modal de detalle: muestra el estado, botones contextuales según estado

### Sidebar

Entrada nueva "Cotizaciones" cerca de "Emitir DTE".

## Error Handling

| Escenario | Comportamiento |
|----------|----------|
| Transición inválida (ej. RECHAZADA → ACEPTADA) | 400 con mensaje claro |
| Editar cotización no-DRAFT | 400 |
| Convertir a factura sin estar ACEPTADA | 400 |
| Cliente sin RUT válido | 400 |
| Número duplicado en mismo company | 409 |

## Testing Strategy

Smoke test `smoke-quotes.ts`:
1. Crear cotización con 2 items
2. Transiciones: DRAFT → SENT → ACCEPTED
3. Convertir a factura → Document tipo 33 creado, Quote.status=INVOICED, invoicedDocumentId presente
4. PDF generado correctamente (validar que devuelve bytes)
5. Intentar transición inválida → 400

## Future Work

- Link público para que el cliente vea y acepte online (con token firmado)
- Email automático al cliente con PDF adjunto al enviar
- Plantillas de cotización guardables
- Convertir cotización a nota de crédito (caso de devolución preventiva)
- Recordatorio automático antes del vencimiento
