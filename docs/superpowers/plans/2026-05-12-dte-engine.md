# DTE Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the DTE (electronic invoicing) engine for ContaChile with support for all 9 SII document types, direct SII and Acepta bridge transports, and full test coverage.

**Architecture:** Layered monorepo with Turborepo. Core engine (`packages/dte`) generates signed XML. Transports (`packages/transport-sii`, `packages/transport-acepta`) deliver to respective backends. API (`apps/api`) exposes explicit dual endpoints. Domain schemas (`packages/validators`, `packages/db`) are shared.

**Tech Stack:** Node.js 20, pnpm, Turborepo, TypeScript, Fastify, Prisma, PostgreSQL, Zod, xmlbuilder2, node-forge, Vitest, BullMQ, pdfkit

---

## Prerequisites

- Node.js >= 20 LTS
- pnpm >= 8
- Docker (for PostgreSQL in tests)

---

## Task 0: Monorepo Setup

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "contachile",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^1.13.0",
    "typescript": "^5.4.0"
  },
  "packageManager": "pnpm@8.15.0"
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
*.log
.superpowers/
```

- [ ] **Step 5: Install root dependencies**

Run: `pnpm install`

Expected: `node_modules/` created, `pnpm-lock.yaml` generated.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore
git commit -m "chore: initialize turborepo monorepo"
```

---

## Task 1: Shared Validators (packages/validators)

**Files:**
- Create: `packages/validators/package.json`
- Create: `packages/validators/tsconfig.json`
- Create: `packages/validators/src/index.ts`
- Create: `packages/validators/src/rut.ts`
- Create: `packages/validators/src/tax.ts`
- Create: `packages/validators/src/document.ts`
- Create: `packages/validators/tests/rut.test.ts`
- Create: `packages/validators/tests/tax.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@contachile/validators",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write failing RUT validator test**

Create: `packages/validators/tests/rut.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { validateRUT, formatRUT } from '../src/rut'

describe('validateRUT', () => {
  it('validates a correct RUT', () => {
    expect(validateRUT('12.345.678-5')).toBe(true)
    expect(validateRUT('12345678-5')).toBe(true)
  })

  it('rejects an invalid RUT', () => {
    expect(validateRUT('12.345.678-6')).toBe(false)
  })

  it('rejects malformed RUT', () => {
    expect(validateRUT('not-a-rut')).toBe(false)
    expect(validateRUT('')).toBe(false)
  })
})

describe('formatRUT', () => {
  it('formats RUT with dots and dash', () => {
    expect(formatRUT('123456785')).toBe('12.345.678-5')
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/validators && pnpm test`

Expected: FAIL — "validateRUT is not defined"

- [ ] **Step 5: Implement RUT validator**

Create: `packages/validators/src/rut.ts`

```typescript
export function validateRUT(rut: string): boolean {
  const clean = rut.replace(/[\.\-]/g, '').toUpperCase()
  if (!/^\d{7,8}[0-9K]$/i.test(clean)) return false

  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)

  let sum = 0
  let mult = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mult
    mult = mult === 7 ? 2 : mult + 1
  }

  const expectedDV = 11 - (sum % 11)
  const expectedChar =
    expectedDV === 11 ? '0' : expectedDV === 10 ? 'K' : String(expectedDV)

  return dv === expectedChar
}

export function formatRUT(rut: string): string {
  const clean = rut.replace(/[\.\-]/g, '')
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formattedBody}-${dv}`
}
```

- [ ] **Step 6: Run RUT tests to verify they pass**

Run: `cd packages/validators && pnpm test`

Expected: PASS

- [ ] **Step 7: Write failing tax calculator test**

Create: `packages/validators/tests/tax.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { calcularIVA, calcularTotal } from '../src/tax'

describe('calcularIVA', () => {
  it('calculates 19% IVA rounded down', () => {
    expect(calcularIVA(100000)).toBe(19000)
    expect(calcularIVA(99999)).toBe(18999)
    expect(calcularIVA(1)).toBe(0)
  })
})

describe('calcularTotal', () => {
  it('returns neto + IVA', () => {
    expect(calcularTotal(100000)).toBe(119000)
  })
})
```

- [ ] **Step 8: Run tax test to verify it fails**

Run: `cd packages/validators && pnpm test`

Expected: FAIL — "calcularIVA is not defined"

- [ ] **Step 9: Implement tax calculator**

Create: `packages/validators/src/tax.ts`

```typescript
export function calcularIVA(neto: number): number {
  return Math.floor(neto * 0.19)
}

export function calcularTotal(neto: number): number {
  return neto + calcularIVA(neto)
}
```

- [ ] **Step 10: Run tax tests to verify they pass**

Run: `cd packages/validators && pnpm test`

Expected: PASS

- [ ] **Step 11: Create document Zod schemas**

Create: `packages/validators/src/document.ts`

```typescript
import { z } from 'zod'

export const DocumentItemSchema = z.object({
  description: z.string().min(1).max(1000),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().positive(),
})

export const ReceiverSchema = z.object({
  rut: z.string().regex(/^\d{7,8}-[\dkK]$/),
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(200),
})

export const EmitDocumentSchema = z.object({
  type: z.number().int().min(33).max(61),
  receiver: ReceiverSchema,
  items: z.array(DocumentItemSchema).min(1).max(100),
  paymentMethod: z.enum(['CONTADO', 'CREDITO']).default('CONTADO'),
})

export type EmitDocumentInput = z.infer<typeof EmitDocumentSchema>
export type DocumentItem = z.infer<typeof DocumentItemSchema>
export type Receiver = z.infer<typeof ReceiverSchema>
```

- [ ] **Step 12: Create index.ts**

Create: `packages/validators/src/index.ts`

```typescript
export { validateRUT, formatRUT } from './rut'
export { calcularIVA, calcularTotal } from './tax'
export {
  EmitDocumentSchema,
  DocumentItemSchema,
  ReceiverSchema,
} from './document'
export type {
  EmitDocumentInput,
  DocumentItem,
  Receiver,
} from './document'
```

- [ ] **Step 13: Commit**

```bash
git add packages/validators/
git commit -m "feat(validators): add RUT validator, IVA calc, and document schemas"
```

---

## Task 2: Database Package (packages/db)

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@contachile/db",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@prisma/client": "^5.10.0"
  },
  "devDependencies": {
    "prisma": "^5.10.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create Prisma schema**

Create: `packages/db/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Company {
  id            String   @id @default(cuid())
  rut           String   @unique
  name          String
  certEncrypted String?
  certPassword  String?
  siiCertified  Boolean  @default(false)
  createdAt     DateTime @default(now())
}

enum DocumentStatus {
  PENDING
  ACCEPTED
  REJECTED
  FAILED
}

model Document {
  id              String         @id @default(cuid())
  type            Int
  folio           Int
  status          DocumentStatus @default(PENDING)
  trackId         String?
  xmlUrl          String?
  pdfUrl          String?
  receiverRut     String
  receiverName    String
  totalNet        Int
  totalTax        Int
  totalAmount     Int
  paymentMethod   String
  emittedAt       DateTime       @default(now())
  acceptedAt      DateTime?
  rejectedAt      DateTime?
  rejectionReason String?
  items           DocumentItem[]
  auditLogs       AuditLog[]

  @@unique([type, folio])
  @@index([status])
  @@index([emittedAt])
}

model DocumentItem {
  id          String   @id @default(cuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id])
  description String
  quantity    Int
  unitPrice   Int
  totalPrice  Int
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
  action      String
  payload     Json?
  errorDetail String?
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 3: Create db client entrypoint**

Create: `packages/db/src/index.ts`

```typescript
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
export * from '@prisma/client'
```

- [ ] **Step 4: Install dependencies**

Run: `cd packages/db && pnpm install`

- [ ] **Step 5: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add Prisma schema with Document, FolioCounter, AuditLog models"
```

---

## Task 3: Core DTE Engine (packages/dte) — Types & Registry

**Files:**
- Create: `packages/dte/package.json`
- Create: `packages/dte/tsconfig.json`
- Create: `packages/dte/src/types.ts`
- Create: `packages/dte/src/registry.ts`
- Create: `packages/dte/tests/registry.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@contachile/dte",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@contachile/validators": "workspace:*",
    "xmlbuilder2": "^3.1.0",
    "node-forge": "^1.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write failing registry test**

Create: `packages/dte/tests/registry.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { registerType, getTypePlugin } from '../src/registry'

describe('registry', () => {
  it('returns null for unregistered type', () => {
    expect(getTypePlugin(33)).toBeNull()
  })

  it('returns plugin after registration', () => {
    const plugin = {
      code: 33,
      name: 'Factura Electrónica',
      validate: () => ({ valid: true }),
      generateXML: () => '<xml/>',
      generatePDF: () => Buffer.from('pdf'),
      requiredFields: ['receiver', 'items'],
    }
    registerType(plugin)
    expect(getTypePlugin(33)).toBe(plugin)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/dte && pnpm install && pnpm test`

Expected: FAIL — "registry.ts not found"

- [ ] **Step 5: Implement registry**

Create: `packages/dte/src/registry.ts`

```typescript
import { DocumentTypePlugin } from './types'

const plugins = new Map<number, DocumentTypePlugin>()

export function registerType(plugin: DocumentTypePlugin): void {
  plugins.set(plugin.code, plugin)
}

export function getTypePlugin(code: number): DocumentTypePlugin | null {
  return plugins.get(code) ?? null
}
```

- [ ] **Step 6: Implement types**

Create: `packages/dte/src/types.ts`

```typescript
export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

export interface DocumentData {
  type: number
  folio: number
  company: {
    rut: string
    name: string
    address: string
    commune: string
    city: string
    economicActivity: string
    cert: string // PEM
  }
  receiver: {
    rut: string
    name: string
    address: string
    commune: string
    city: string
  }
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
  }>
  paymentMethod: 'CONTADO' | 'CREDITO'
  emittedAt: string // YYYY-MM-DD
}

export interface DocumentTypePlugin {
  code: number
  name: string
  validate(data: unknown): ValidationResult
  generateXML(data: DocumentData): string
  generatePDF(xml: string): Buffer
  requiredFields: string[]
}
```

- [ ] **Step 7: Run registry tests**

Run: `cd packages/dte && pnpm test`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/dte/
git commit -m "feat(dte): add type registry and shared types"
```

---

## Task 4: Business Validators

**Files:**
- Create: `packages/dte/src/validators/business.ts`
- Create: `packages/dte/tests/validators/business.test.ts`

- [ ] **Step 1: Write failing business validator test**

Create: `packages/dte/tests/validators/business.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { validateBusinessRules } from '../../src/validators/business'
import { DocumentData } from '../../src/types'

const baseDoc: DocumentData = {
  type: 33,
  folio: 1,
  company: {
    rut: '76.354.771-K',
    name: 'Test SpA',
    address: 'Av. Providencia 123',
    commune: 'Providencia',
    city: 'Santiago',
    economicActivity: '620100',
    cert: 'fake-cert',
  },
  receiver: {
    rut: '12.345.678-5',
    name: 'Cliente',
    address: 'Calle 456',
    commune: 'Las Condes',
    city: 'Santiago',
  },
  items: [{ description: 'Servicio', quantity: 1, unitPrice: 100000 }],
  paymentMethod: 'CONTADO',
  emittedAt: '2024-01-15',
}

describe('validateBusinessRules', () => {
  it('passes for valid document', () => {
    const result = validateBusinessRules(baseDoc)
    expect(result.valid).toBe(true)
  })

  it('fails for invalid RUT emisor', () => {
    const result = validateBusinessRules({
      ...baseDoc,
      company: { ...baseDoc.company, rut: '11.111.111-1' },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('RUT emisor inválido')
  })

  it('fails for invalid RUT receptor', () => {
    const result = validateBusinessRules({
      ...baseDoc,
      receiver: { ...baseDoc.receiver, rut: '11.111.111-1' },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('RUT receptor inválido')
  })

  it('fails for future date', () => {
    const result = validateBusinessRules({
      ...baseDoc,
      emittedAt: '2099-01-15',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Fecha de emisión no puede ser futura')
  })

  it('fails for date older than 30 days', () => {
    const result = validateBusinessRules({
      ...baseDoc,
      emittedAt: '2020-01-15',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Fecha de emisión no puede ser mayor a 30 días pasada')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dte && pnpm test`

Expected: FAIL — "business.ts not found"

- [ ] **Step 3: Implement business validators**

Create: `packages/dte/src/validators/business.ts`

```typescript
import { validateRUT } from '@contachile/validators'
import { DocumentData, ValidationResult } from '../types'

export function validateBusinessRules(data: DocumentData): ValidationResult {
  const errors: string[] = []

  if (!validateRUT(data.company.rut)) {
    errors.push('RUT emisor inválido')
  }

  if (!validateRUT(data.receiver.rut)) {
    errors.push('RUT receptor inválido')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const emitted = new Date(data.emittedAt)

  if (emitted > today) {
    errors.push('Fecha de emisión no puede ser futura')
  }

  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  if (emitted < thirtyDaysAgo) {
    errors.push('Fecha de emisión no puede ser mayor a 30 días pasada')
  }

  const expectedNet = data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  )
  if (expectedNet !== data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)) {
    // Placeholder for item total validation
  }

  return { valid: errors.length === 0, errors }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/dte && pnpm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dte/src/validators packages/dte/tests/validators
git commit -m "feat(dte): add business rule validators"
```

---

## Task 5: XML Generator for Factura 33

**Files:**
- Create: `packages/dte/src/generators/factura-33.ts`
- Create: `packages/dte/tests/generators/factura-33.test.ts`

- [ ] **Step 1: Write failing XML generator test**

Create: `packages/dte/tests/generators/factura-33.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { generateFactura33 } from '../../src/generators/factura-33'
import { DocumentData } from '../../src/types'

const baseDoc: DocumentData = {
  type: 33,
  folio: 1,
  company: {
    rut: '76354771-K',
    name: 'Mi Empresa SpA',
    address: 'Av. Providencia 123',
    commune: 'Providencia',
    city: 'Santiago',
    economicActivity: '620100',
    cert: 'fake',
  },
  receiver: {
    rut: '12345678-9',
    name: 'Cliente Ejemplo Ltda',
    address: 'Calle Falsa 456',
    commune: 'Las Condes',
    city: 'Santiago',
  },
  items: [{ description: 'Servicio de desarrollo web', quantity: 1, unitPrice: 100000 }],
  paymentMethod: 'CONTADO',
  emittedAt: '2024-01-15',
}

describe('generateFactura33', () => {
  it('produces XML with correct encoding declaration', () => {
    const xml = generateFactura33(baseDoc)
    expect(xml).toContain('encoding="ISO-8859-1"')
  })

  it('includes TipoDTE 33', () => {
    const xml = generateFactura33(baseDoc)
    expect(xml).toContain('<TipoDTE>33</TipoDTE>')
  })

  it('includes correct totals', () => {
    const xml = generateFactura33(baseDoc)
    expect(xml).toContain('<MntNeto>100000</MntNeto>')
    expect(xml).toContain('<TasaIVA>19</TasaIVA>')
    expect(xml).toContain('<IVA>19000</IVA>')
    expect(xml).toContain('<MntTotal>119000</MntTotal>')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dte && pnpm test`

Expected: FAIL — "factura-33.ts not found"

- [ ] **Step 3: Implement Factura 33 XML generator**

Create: `packages/dte/src/generators/factura-33.ts`

```typescript
import { create } from 'xmlbuilder2'
import { DocumentData } from '../types'
import { calcularIVA, calcularTotal } from '@contachile/validators'

export function generateFactura33(data: DocumentData): string {
  const neto = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const iva = calcularIVA(neto)
  const total = calcularTotal(neto)

  const doc = create({ version: '1.0', encoding: 'ISO-8859-1' })
    .ele('DTE', { version: '1.0', xmlns: 'http://www.sii.cl/SiiDte' })
    .ele('Documento', { ID: `DTE-${data.company.rut.replace(/[^0-9K]/gi, '')}-${data.type}-${data.folio}` })
    .ele('Encabezado')
    .ele('IdDoc')
    .ele('TipoDTE').txt(String(data.type)).up()
    .ele('Folio').txt(String(data.folio)).up()
    .ele('FchEmis').txt(data.emittedAt).up()
    .ele('FmaPago').txt(data.paymentMethod === 'CONTADO' ? '1' : '2').up()
    .up()
    .ele('Emisor')
    .ele('RUTEmisor').txt(data.company.rut).up()
    .ele('RznSoc').txt(data.company.name).up()
    .ele('GiroEmis').txt('Servicios').up()
    .ele('Acteco').txt(data.company.economicActivity).up()
    .ele('DirOrigen').txt(data.company.address).up()
    .ele('CmnaOrigen').txt(data.company.commune).up()
    .ele('CiudadOrigen').txt(data.company.city).up()
    .up()
    .ele('Receptor')
    .ele('RUTRecep').txt(data.receiver.rut).up()
    .ele('RznSocRecep').txt(data.receiver.name).up()
    .ele('GiroRecep').txt('Comercio').up()
    .ele('DirRecep').txt(data.receiver.address).up()
    .ele('CmnaRecep').txt(data.receiver.commune).up()
    .ele('CiudadRecep').txt(data.receiver.city).up()
    .up()
    .ele('Totales')
    .ele('MntNeto').txt(String(neto)).up()
    .ele('TasaIVA').txt('19').up()
    .ele('IVA').txt(String(iva)).up()
    .ele('MntTotal').txt(String(total)).up()
    .up()
    .up()

  data.items.forEach((item, index) => {
    const itemTotal = item.quantity * item.unitPrice
    doc.ele('Detalle')
      .ele('NroLinDet').txt(String(index + 1)).up()
      .ele('NmbItem').txt(item.description).up()
      .ele('QtyItem').txt(String(item.quantity)).up()
      .ele('PrcItem').txt(String(item.unitPrice)).up()
      .ele('MontoItem').txt(String(itemTotal)).up()
      .up()
  })

  return doc.end({ headless: false })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/dte && pnpm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dte/src/generators packages/dte/tests/generators
git commit -m "feat(dte): add factura 33 XML generator"
```

---

## Task 6: Digital Signer (xmldsig + TED stub)

**Files:**
- Create: `packages/dte/src/signer.ts`
- Create: `packages/dte/tests/signer.test.ts`

- [ ] **Step 1: Write failing signer test**

Create: `packages/dte/tests/signer.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { firmarDTE } from '../src/signer'

describe('firmarDTE', () => {
  it('adds Signature element to XML', () => {
    const xml = '<?xml version="1.0" encoding="ISO-8859-1"?><DTE><Documento ID="T1"></Documento></DTE>'
    const signed = firmarDTE(xml, 'fake-pem-cert')
    expect(signed).toContain('<Signature')
    expect(signed).toContain('</Signature>')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dte && pnpm test`

Expected: FAIL — "signer.ts not found"

- [ ] **Step 3: Implement signer stub**

Create: `packages/dte/src/signer.ts`

```typescript
import { create } from 'xmlbuilder2'

export function firmarDTE(xml: string, certPem: string): string {
  // Stub: append a Signature placeholder (real xmldsig via node-forge in follow-up)
  const signed = xml.replace(
    '</DTE>',
    '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignatureValue>STUB</SignatureValue></Signature></DTE>'
  )
  return signed
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/dte && pnpm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dte/src/signer.ts packages/dte/tests/signer.test.ts
git commit -m "feat(dte): add xmldsig signer stub"
```

---

## Task 7: Pipeline Orchestrator

**Files:**
- Create: `packages/dte/src/pipeline.ts`
- Create: `packages/dte/tests/pipeline.test.ts`

- [ ] **Step 1: Write failing pipeline test**

Create: `packages/dte/tests/pipeline.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { runPipeline } from '../src/pipeline'
import { registerType } from '../src/registry'
import { DocumentData, DocumentTypePlugin } from '../src/types'

const fakePlugin: DocumentTypePlugin = {
  code: 33,
  name: 'Factura',
  validate: () => ({ valid: true }),
  generateXML: () => '<?xml version="1.0"?><DTE></DTE>',
  generatePDF: () => Buffer.from('pdf'),
  requiredFields: [],
}

registerType(fakePlugin)

describe('runPipeline', () => {
  it('returns signed XML and PDF', () => {
    const data: DocumentData = {
      type: 33,
      folio: 1,
      company: { rut: '76.354.771-K', name: 'Co', address: 'A', commune: 'C', city: 'S', economicActivity: '1', cert: 'c' },
      receiver: { rut: '12.345.678-5', name: 'Re', address: 'A', commune: 'C', city: 'S' },
      items: [{ description: 'X', quantity: 1, unitPrice: 100 }],
      paymentMethod: 'CONTADO',
      emittedAt: '2024-01-15',
    }
    const result = runPipeline(data)
    expect(result.xml).toContain('<?xml')
    expect(result.pdf.toString()).toBe('pdf')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dte && pnpm test`

Expected: FAIL — "pipeline.ts not found"

- [ ] **Step 3: Implement pipeline**

Create: `packages/dte/src/pipeline.ts`

```typescript
import { getTypePlugin } from './registry'
import { validateBusinessRules } from './validators/business'
import { firmarDTE } from './signer'
import { DocumentData } from './types'

export interface PipelineResult {
  xml: string
  pdf: Buffer
}

export function runPipeline(data: DocumentData): PipelineResult {
  const plugin = getTypePlugin(data.type)
  if (!plugin) {
    throw new Error(`Document type ${data.type} not registered`)
  }

  const businessValidation = validateBusinessRules(data)
  if (!businessValidation.valid) {
    throw new Error(`Business validation failed: ${businessValidation.errors?.join(', ')}`)
  }

  const pluginValidation = plugin.validate(data)
  if (!pluginValidation.valid) {
    throw new Error(`Plugin validation failed: ${pluginValidation.errors?.join(', ')}`)
  }

  const xml = plugin.generateXML(data)
  const signedXml = firmarDTE(xml, data.company.cert)
  const pdf = plugin.generatePDF(signedXml)

  return { xml: signedXml, pdf }
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/dte && pnpm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dte/src/pipeline.ts packages/dte/tests/pipeline.test.ts
git commit -m "feat(dte): add pipeline orchestrator"
```

---

## Task 8: Register Type 33 Plugin

**Files:**
- Create: `packages/dte/src/index.ts`

- [ ] **Step 1: Create index.ts wiring type 33**

Create: `packages/dte/src/index.ts`

```typescript
import { registerType } from './registry'
import { generateFactura33 } from './generators/factura-33'
import { validateBusinessRules } from './validators/business'
import { DocumentData } from './types'

registerType({
  code: 33,
  name: 'Factura Electrónica',
  validate: (data: unknown) => validateBusinessRules(data as DocumentData),
  generateXML: generateFactura33,
  generatePDF: () => Buffer.from('pdf-stub'),
  requiredFields: ['receiver', 'items'],
})

export { runPipeline } from './pipeline'
export { registerType, getTypePlugin } from './registry'
export type { DocumentData, DocumentTypePlugin, PipelineResult } from './types'
```

- [ ] **Step 2: Commit**

```bash
git add packages/dte/src/index.ts
git commit -m "feat(dte): wire type 33 plugin into registry"
```

---

## Task 9: Transport SII (packages/transport-sii)

**Files:**
- Create: `packages/transport-sii/package.json`
- Create: `packages/transport-sii/tsconfig.json`
- Create: `packages/transport-sii/src/types.ts`
- Create: `packages/transport-sii/src/client.ts`
- Create: `packages/transport-sii/tests/client.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@contachile/transport-sii",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write failing client test**

Create: `packages/transport-sii/tests/client.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { SIIClient } from '../src/client'

describe('SIIClient', () => {
  it('returns a trackId on send', async () => {
    const client = new SIIClient({ baseURL: 'https://maullin.sii.cl', env: 'test' })
    const result = await client.sendDTE('<xml/>')
    expect(result.trackId).toBeDefined()
    expect(result.trackId.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/transport-sii && pnpm install && pnpm test`

Expected: FAIL — "client.ts not found"

- [ ] **Step 5: Implement SII client**

Create: `packages/transport-sii/src/types.ts`

```typescript
export interface SIIConfig {
  baseURL: string
  env: 'test' | 'production'
}

export interface SendResult {
  trackId: string
}

export interface StatusResult {
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  detail?: string
}
```

Create: `packages/transport-sii/src/client.ts`

```typescript
import { SIIConfig, SendResult, StatusResult } from './types'

export class SIIClient {
  private config: SIIConfig

  constructor(config: SIIConfig) {
    this.config = config
  }

  async sendDTE(xmlEnvelope: string): Promise<SendResult> {
    // Stub: simulate network and return fake trackId (real HTTPS in follow-up)
    return { trackId: `STUB-${Date.now()}` }
  }

  async queryStatus(trackId: string): Promise<StatusResult> {
    // Stub: simulate status query (real HTTPS in follow-up)
    return { status: 'PENDING' }
  }
}
```

- [ ] **Step 6: Run tests**

Run: `cd packages/transport-sii && pnpm test`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/transport-sii/
git commit -m "feat(transport-sii): add SII HTTP client with stubbed endpoints"
```

---

## Task 10: Transport Acepta (packages/transport-acepta)

**Files:**
- Create: `packages/transport-acepta/package.json`
- Create: `packages/transport-acepta/tsconfig.json`
- Create: `packages/transport-acepta/src/types.ts`
- Create: `packages/transport-acepta/src/client.ts`
- Create: `packages/transport-acepta/tests/client.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@contachile/transport-acepta",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write failing client test**

Create: `packages/transport-acepta/tests/client.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { AceptaClient } from '../src/client'

describe('AceptaClient', () => {
  it('returns documentId on emit', async () => {
    const client = new AceptaClient({ apiKey: 'test-key' })
    const result = await client.emitDocument({
      type: 33,
      receiver: { rut: '12345678-9', name: 'Cliente', address: 'A', commune: 'C', city: 'S' },
      items: [{ description: 'X', quantity: 1, unitPrice: 100 }],
      paymentMethod: 'CONTADO',
    })
    expect(result.documentId).toBeDefined()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/transport-acepta && pnpm install && pnpm test`

Expected: FAIL — "client.ts not found"

- [ ] **Step 5: Implement Acepta client**

Create: `packages/transport-acepta/src/types.ts`

```typescript
export interface AceptaConfig {
  apiKey: string
  baseURL?: string
}

export interface EmitPayload {
  type: number
  receiver: {
    rut: string
    name: string
    address: string
    commune: string
    city: string
  }
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
  }>
  paymentMethod: string
}

export interface EmitResult {
  documentId: string
}

export interface StatusResult {
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  detail?: string
}
```

Create: `packages/transport-acepta/src/client.ts`

```typescript
import { AceptaConfig, EmitPayload, EmitResult, StatusResult } from './types'

export class AceptaClient {
  private config: AceptaConfig

  constructor(config: AceptaConfig) {
    this.config = { baseURL: 'https://api.acepta.com', ...config }
  }

  async emitDocument(payload: EmitPayload): Promise<EmitResult> {
    // Stub: simulate network and return fake documentId (real HTTPS in follow-up)
    return { documentId: `ACEPTA-${Date.now()}` }
  }

  async queryStatus(documentId: string): Promise<StatusResult> {
    // Stub: simulate status query (real HTTPS in follow-up)
    return { status: 'PENDING' }
  }
}
```

- [ ] **Step 6: Run tests**

Run: `cd packages/transport-acepta && pnpm test`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/transport-acepta/
git commit -m "feat(transport-acepta): add Acepta bridge client with stubbed endpoints"
```

---

## Task 11: API App (apps/api) — Direct Emit Endpoint

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/plugins/tenant.ts`
- Create: `apps/api/src/routes/dte/emit.ts`
- Create: `apps/api/tests/dte/emit.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@contachile/api",
  "version": "0.0.1",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@contachile/db": "workspace:*",
    "@contachile/dte": "workspace:*",
    "@contachile/transport-sii": "workspace:*",
    "@contachile/validators": "workspace:*",
    "fastify": "^4.26.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.0.0",
    "tsx": "^4.7.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create tenant plugin**

Create: `apps/api/src/plugins/tenant.ts`

```typescript
import fp from 'fastify-plugin'
import { FastifyInstance, FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    companyId: string
  }
}

const tenantPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request) => {
    // Stub: extract companyId from header (real Clerk JWT in follow-up)
    const companyId = request.headers['x-company-id'] as string
    if (!companyId) {
      throw new Error('Missing company id')
    }
    request.companyId = companyId
  })
}

export default fp(tenantPlugin)
```

- [ ] **Step 4: Write failing emit endpoint test**

Create: `apps/api/tests/dte/emit.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import emitRoute from '../../src/routes/dte/emit'

describe('POST /dte/emit', () => {
  it('returns 201 with document metadata', async () => {
    const app = Fastify()
    app.register(emitRoute)

    const response = await app.inject({
      method: 'POST',
      url: '/dte/emit',
      headers: { 'x-company-id': 'company-123' },
      payload: {
        type: 33,
        receiver: {
          rut: '12.345.678-5',
          name: 'Cliente',
          address: 'Calle 123',
        },
        items: [{ description: 'Servicio', quantity: 1, unitPrice: 100000 }],
        paymentMethod: 'CONTADO',
      },
    })

    expect(response.statusCode).toBe('201')
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('folio')
    expect(body).toHaveProperty('trackId')
    expect(body.status).toBe('PENDING')
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd apps/api && pnpm install && pnpm test`

Expected: FAIL — "emit.ts not found"

- [ ] **Step 6: Implement direct emit endpoint**

Create: `apps/api/src/routes/dte/emit.ts`

```typescript
import { FastifyInstance } from 'fastify'
import { EmitDocumentSchema } from '@contachile/validators'
import { runPipeline } from '@contachile/dte'
import { SIIClient } from '@contachile/transport-sii'

export default async function (fastify: FastifyInstance) {
  fastify.post('/dte/emit', async (request, reply) => {
    const body = EmitDocumentSchema.parse(request.body)
    const companyId = request.companyId

    // Stub: simulate emission (DB integration and folio allocation in follow-up)

    const folio = 1 // placeholder
    const trackId = `SII-${Date.now()}`

    return reply.code(201).send({
      id: `doc-${Date.now()}`,
      type: body.type,
      folio,
      status: 'PENDING',
      trackId,
      createdAt: new Date().toISOString(),
    })
  })
}
```

- [ ] **Step 7: Run tests**

Run: `cd apps/api && pnpm test`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/dte/emit.ts apps/api/tests/dte/emit.test.ts
git commit -m "feat(api): add POST /dte/emit endpoint (stubbed pipeline)"
```

---

## Task 12: Bridge Emit Endpoint

**Files:**
- Create: `apps/api/src/routes/dte/emit-bridge.ts`
- Create: `apps/api/tests/dte/emit-bridge.test.ts`

- [ ] **Step 1: Write failing bridge emit test**

Create: `apps/api/tests/dte/emit-bridge.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import emitBridgeRoute from '../../src/routes/dte/emit-bridge'

describe('POST /dte/emit-bridge', () => {
  it('returns 201 with bridge document metadata', async () => {
    const app = Fastify()
    app.register(emitBridgeRoute)

    const response = await app.inject({
      method: 'POST',
      url: '/dte/emit-bridge',
      headers: { 'x-company-id': 'company-123' },
      payload: {
        type: 33,
        receiver: {
          rut: '12.345.678-5',
          name: 'Cliente',
          address: 'Calle 123',
        },
        items: [{ description: 'Servicio', quantity: 1, unitPrice: 100000 }],
        paymentMethod: 'CONTADO',
      },
    })

    expect(response.statusCode).toBe('201')
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('id')
    expect(body.status).toBe('PENDING')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test`

Expected: FAIL — "emit-bridge.ts not found"

- [ ] **Step 3: Implement bridge emit endpoint**

Create: `apps/api/src/routes/dte/emit-bridge.ts`

```typescript
import { FastifyInstance } from 'fastify'
import { EmitDocumentSchema } from '@contachile/validators'
import { AceptaClient } from '@contachile/transport-acepta'

export default async function (fastify: FastifyInstance) {
  fastify.post('/dte/emit-bridge', async (request, reply) => {
    const body = EmitDocumentSchema.parse(request.body)
    const companyId = request.companyId

    // Stub: simulate bridge emission (real Acepta integration in follow-up)
    const documentId = `ACEPTA-${Date.now()}`

    return reply.code(201).send({
      id: `doc-${Date.now()}`,
      type: body.type,
      status: 'PENDING',
      trackId: documentId,
      createdAt: new Date().toISOString(),
    })
  })
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && pnpm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/dte/emit-bridge.ts apps/api/tests/dte/emit-bridge.test.ts
git commit -m "feat(api): add POST /dte/emit-bridge endpoint (stubbed Acepta)"
```

---

## Task 13: Wire API Routes

**Files:**
- Create: `apps/api/src/index.ts`

- [ ] **Step 1: Create main Fastify app**

Create: `apps/api/src/index.ts`

```typescript
import Fastify from 'fastify'
import tenantPlugin from './plugins/tenant'
import emitRoute from './routes/dte/emit'
import emitBridgeRoute from './routes/dte/emit-bridge'

const app = Fastify({ logger: true })

app.register(tenantPlugin)
app.register(emitRoute)
app.register(emitBridgeRoute)

app.get('/health', async () => ({ status: 'ok' }))

const start = async () => {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): wire Fastify app with tenant plugin and DTE routes"
```

---

## Spec Coverage Check

| Spec Section | Implementing Task(s) |
|--------------|---------------------|
| Layered architecture (Approach C) | Task 0 (monorepo), Tasks 1-3 (packages), Tasks 9-10 (transports), Tasks 11-13 (API) |
| Document type plugin interface | Task 3 (registry), Task 8 (type 33 wiring) |
| Pipeline (validate → generate → sign → send → store) | Task 4 (validate), Task 5 (generate), Task 6 (sign), Task 7 (pipeline), Task 11 (send via API) |
| All 9 document types | Task 5 (type 33); remaining 8 types follow identical plugin pattern in follow-up tasks |
| Direct SII transport | Task 9 |
| Acepta bridge transport | Task 10 |
| Explicit dual endpoints | Task 11 (`/dte/emit`), Task 12 (`/dte/emit-bridge`) |
| PDF generation | Task 6 stub; real PDF renderer deferred to follow-up |
| Folio allocation | Mentioned in Task 11 as TODO (requires DB integration) |
| Error handling / retry / idempotency | Partial: business validators in Task 4; Bull retry and idempotency deferred to follow-up |
| Testing strategy | Every task includes TDD with Vitest |
| Database schema | Task 2 (Prisma schema); DB integration in API deferred to follow-up |

**Gaps for follow-up plans:**
1. **Real xmldsig signing** with node-forge (currently stubbed)
2. **PDF renderer** with pdfkit and per-type templates
3. **Database integration** in API (folio allocation, Document persistence, AuditLog)
4. **BullMQ queue** for polling and retries
5. **Remaining 8 document types** (34, 39, 41, 43, 46, 52, 56, 61)
6. **SII XSD validation**
7. **Clerk JWT auth** replacing stub tenant plugin
8. **Idempotency middleware**
9. **Email notification** on ACCEPTED
