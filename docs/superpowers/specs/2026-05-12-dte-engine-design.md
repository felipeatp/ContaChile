# DTE Engine Design — ContaChile

## Overview

This document specifies the DTE (Documento Tributario Electrónico) engine for ContaChile, covering electronic invoicing for Chilean tax compliance. The engine supports all 9 SII document types (33, 34, 39, 41, 43, 46, 52, 56, 61) with a hybrid delivery strategy: a direct SII path (own XML generation, signing, and SII API integration) and a bridge path via Acepta.com for rapid launch before SII certification is complete.

## Goals

- Emit legally valid DTEs in Chile via both direct SII and Acepta bridge
- Support all 9 SII document types with a plugin-based architecture
- Guarantee unique folio allocation per company and document type
- Provide signed XML, PDF representation, and status tracking for every document
- Handle SII network failures, certificate issues, and rejection scenarios gracefully

## Non-goals

- UI/frontend for invoice creation (separate design)
- Email delivery of PDFs to customers (separate design)
- Reception of DTEs from suppliers (separate design)
- Multi-currency or international invoicing (Chilean peso only)

## Architecture

### Layered design (Approach C)

```
┌─────────────────────────────────────┐
│  apps/api (Fastify)                 │
│  POST /dte/emit      → direct SII   │
│  POST /dte/emit-bridge → Acepta     │
│  GET  /dte/:id/status               │
│  GET  /dte/:id/pdf                  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Transport layer                    │
│  packages/transport-sii   (direct)  │
│  packages/transport-acepta (bridge) │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Core engine                        │
│  packages/dte                       │
│  - Document type plugins (9 types)  │
│  - XML generators                   │
│  - xmldsig signer + TED builder     │
│  - XSD validator                    │
│  - PDF renderer                     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Domain layer                       │
│  packages/validators (Zod schemas)  │
│  packages/db (Prisma models)        │
└─────────────────────────────────────┘
```

### Design principles

1. **Transports are swappable**: Both implement the same interface. The API layer picks one explicitly via route.
2. **Core engine is SII-only**: `packages/dte` knows nothing about Acepta. It produces signed XML and PDFs.
3. **Domain is shared**: Zod schemas and Prisma types are used by both transports, so validation is consistent.
4. **Bridge is a transport**: Acepta handles XML generation and signing on their side, so `transport-acepta` maps our domain model to their JSON API.

## Core Engine Internals (packages/dte)

### Document type plugin interface

Each of the 9 document types is a lightweight plugin registered at runtime. All share the same pipeline.

```typescript
interface DocumentTypePlugin {
  code: number;                    // 33, 39, 56, ...
  name: string;
  validate(data: unknown): ValidationResult;
  generateXML(data: DocumentData): XMLString;
  generatePDF(xml: XMLString): PDFBuffer;
  requiredFields: string[];
}
```

### Pipeline for direct SII path

1. **Validate** — Zod schema (shared) + business rules (folio range, RUT modulo 11, IVA math)
2. **Generate XML** — Plugin produces XMLDocument, then add TED (timbre from CAF), then xmldsig signature with company cert
3. **Validate XML** — XSD check against SII schemas; fail fast before sending
4. **Build Envelope** — Wrap in `EnvioDTE` with SetDTE header and sender signature
5. **Send to SII** — POST to maullin.sii.cl (test) or api.sii.cl (prod); receive trackId
6. **Poll / Store** — Poll trackId until accepted/rejected; store XML + PDF in DB and R2

### Pipeline for bridge path (Acepta)

1. **Validate** — Same Zod schema as direct path (shared validation)
2. **Map to Acepta** — Convert DocumentData to Acepta JSON payload (no XML/TED/signing on our side)
3. **Send via Acepta API** — POST to Acepta; they handle SII certification, signing, and delivery
4. **Webhook / Poll** — Receive status updates via Acepta webhook; store result in DB

### PDF generation

For direct SII: PDF is generated from the signed XML using a template per document type. For bridge: PDF is downloaded from Acepta or generated locally from their response XML.

## API Endpoints & Data Flow

### Endpoint map

| Method | Path | Description |
|--------|------|-------------|
| POST | `/dte/emit` | Emit via own SII library (direct) |
| POST | `/dte/emit-bridge` | Emit via Acepta bridge |
| GET | `/dte/:id` | Get document metadata + status |
| GET | `/dte/:id/xml` | Download signed XML |
| GET | `/dte/:id/pdf` | Download PDF representation |
| GET | `/dte/:id/status` | Poll SII or Acepta for current status |

### Request/response shape

Both endpoints accept the same payload. The route determines the transport.

```typescript
// POST /dte/emit or /dte/emit-bridge
{
  "type": 33,                    // DocumentType code
  "receiver": {
    "rut": "12345678-9",
    "name": "Cliente Ejemplo SpA",
    "address": "..."
  },
  "items": [
    { "description": "Servicio", "quantity": 1, "unitPrice": 100000 }
  ],
  "paymentMethod": "CONTADO"     // or "CREDITO"
}

// Response (201 Created)
{
  "id": "doc_abc123",
  "type": 33,
  "folio": 42,
  "status": "PENDING",
  "trackId": "SII-TRACK-12345",  // or Acepta tracking ID
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Direct SII data flow

1. **Auth + tenant resolution** — Clerk JWT → extract companyId → switch to tenant schema
2. **Folio allocation** — Atomic increment of next folio for type 33 in company schema; lock to prevent duplicates
3. **Call packages/dte** — Pass document data + company cert + folio → receive signed XML + PDF
4. **Call transport-sii** — Send EnvioDTE envelope → receive trackId
5. **Persist** — Save Document record (PENDING), store XML/PDF in R2, enqueue Bull job to poll trackId
6. **Background polling** — Bull worker queries SII every 5 min until ACCEPTED/REJECTED; updates DB + notifies user

### Bridge (Acepta) data flow

1. **Auth + tenant resolution** — Same as direct
2. **No folio allocation** — Acepta manages folios via their own CAF integration
3. **Call transport-acepta** — Map to Acepta JSON → POST → receive Acepta documentId
4. **Persist** — Save Document record with bridgeDocumentId; status = PENDING
5. **Webhook or poll** — Acepta calls our webhook on status change; fallback poll every 5 min via Bull

## Database Schema

### Tenant schema (per company)

```prisma
enum DocumentStatus {
  PENDING
  ACCEPTED
  REJECTED
  FAILED
}

model Document {
  id                String   @id @default(cuid())
  type              Int      // 33, 34, 39, 41, 43, 46, 52, 56, 61
  folio             Int
  status            DocumentStatus @default(PENDING)
  trackId           String?  // SII trackId or Acepta documentId
  xmlUrl            String?  // R2 URL
  pdfUrl            String?  // R2 URL
  receiverRut       String
  receiverName      String
  totalNet          Int      // in CLP cents
  totalTax          Int      // IVA in CLP cents
  totalAmount       Int      // in CLP cents
  paymentMethod     String
  emittedAt         DateTime @default(now())
  acceptedAt        DateTime?
  rejectedAt        DateTime?
  rejectionReason   String?
  items             DocumentItem[]
  auditLogs         AuditLog[]
  @@unique([type, folio])
  @@index([status])
  @@index([emittedAt])
}

model DocumentItem {
  id            String @id @default(cuid())
  documentId    String
  document      Document @relation(fields: [documentId], references: [id])
  description   String
  quantity      Int
  unitPrice     Int
  totalPrice    Int
}

model FolioCounter {
  id        String @id @default(cuid())
  companyId String
  type      Int
  nextFolio Int
  @@unique([companyId, type])
}

model AuditLog {
  id          String   @id @default(cuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id])
  action      String   // EMIT, POLL, ACCEPT, REJECT, RETRY
  payload     Json?
  errorDetail String?
  createdAt   DateTime @default(now())
}
```

### Public schema

```prisma
model Company {
  id            String   @id @default(cuid())
  rut           String   @unique
  name          String
  certEncrypted String?  // AES-256 encrypted digital certificate
  certPassword  String?  // encrypted with KMS
  siiCertified  Boolean  @default(false) // true when own SII cert is active
  createdAt     DateTime @default(now())
}
```

## Error Handling & Retry Strategy

### Error categories

| Layer | Failure | Handling |
|-------|---------|----------|
| Validation | RUT inválido, IVA no cuadra, folio fuera de rango | 400 Bad Request + detailed error list (field + message) |
| Certificate | Cert expirado, password incorrecto, no cargado | 409 Conflict + alerta email al usuario |
| SII network | Timeout, 5xx, maullin no responde | Bull retry con backoff (5min, 15min, 1h, 4h) |
| SII rejection | XML mal formado, firma inválida, TED incorrecto | FAILED status + log detallado + notificación; no retry automático (requiere fix) |
| Acepta | API error, límite de crédito, JSON inválido | Map error code → mensaje usuario; retry solo para 5xx |

### Retry policy (Bull queue)

**Direct SII polling job:**
- Initial delay: 30 seconds after emission
- Subsequent polls: every 5 minutes, max 24 attempts (2 hours)
- If SII returns 5xx or timeout: retry with exponential backoff (5min, 15min, 1h, 4h, 12h)
- If REJECTED: stop polling, mark FAILED, notify user with SII error detail
- If ACCEPTED: mark ACCEPTED, enqueue PDF email job

### Idempotency

Both `POST /dte/emit` and `POST /dte/emit-bridge` accept an `Idempotency-Key` header (UUID). If the same key is seen within 24h for the same company, return the existing document without re-emitting.

### Audit log

Every state change (PENDING → ACCEPTED, PENDING → FAILED, retry attempts) is written to the `AuditLog` table with: timestamp, companyId, documentId, action, payload snapshot, error detail.

## Testing Strategy

### Unit tests (packages/dte)

| Module | What to test | Target |
|--------|-------------|--------|
| Validators | RUT mod11, IVA math, folio range, date bounds | 100% |
| XML generators | Each type (33,34,39,41,43,46,52,56,61) produces well-formed XML | 100% |
| Signer | xmldsig with test cert, TED generation, CAF validation | 100% |
| XSD validator | Valid XML passes, invalid XML fails with specific error | 100% |
| PDF renderer | Output exists, contains key fields, handles encoding | 90% |

### Integration tests

- **Mock SII server**: Local Express server that mimics maullin.sii.cl endpoints. Tests run against it to verify the full direct-SII flow without network.
- **Mock Acepta server**: Same idea for the bridge path. Validates JSON mapping and webhook handling.
- **DB + queue tests**: Test folio allocation concurrency (10 parallel requests, expect 10 unique folios). Test Bull job enqueue and processing.

### End-to-end tests

Spin up the full API with test database, emit a document via `POST /dte/emit` against mock SII, verify:
- Response is 201 with trackId
- Document row exists in DB with PENDING status
- XML is stored in R2 (or local mock storage)
- Polling job is enqueued in Bull
- After mock SII returns ACCEPTED, status updates and email job is queued

### Property-based tests (optional)

Use a library like fast-check to generate random valid/invalid DTE inputs and verify the validator catches all invalid ones and the generator never crashes on valid ones.

## Security Considerations

- Digital certificates are stored AES-256 encrypted in the database; encryption key is managed via AWS KMS or Cloudflare KV and never stored alongside the certificate.
- All SII API calls use TLS 1.3.
- Rate limiting: 100 requests/minute per tenant on DTE endpoints.
- JWT authentication via Clerk with tenant resolution middleware.
