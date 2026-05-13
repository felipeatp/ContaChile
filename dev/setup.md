# Setup del Entorno de Desarrollo

## Prerequisitos

```bash
node --version  # >= 20 LTS
pnpm --version  # >= 8 (gestor de paquetes recomendado)
docker --version # para PostgreSQL local
```

## Crear el monorepo

```bash
# 1. Crear estructura con Turborepo
npx create-turbo@latest contachile
cd contachile

# 2. Instalar dependencias base
pnpm install

# 3. Crear apps y packages
mkdir -p apps/web apps/api packages/dte packages/db packages/ai-agents packages/validators
```

## Setup de la base de datos (Prisma + PostgreSQL)

```bash
# packages/db/schema.prisma
```

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Schema público (multi-tenant)
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  name      String?
  createdAt DateTime  @default(now())
  companies Company[]
}

model Company {
  id            String   @id @default(cuid())
  rut           String   @unique
  name          String
  legalName     String
  economicActivity String
  address       String
  commune       String
  city          String
  ownerId       String
  owner         User     @relation(fields: [ownerId], references: [id])
  plan          Plan     @default(FREE)
  createdAt     DateTime @default(now())
  
  // Certificado digital cifrado (para DTE)
  certEncrypted String?
  certPassword  String?  // cifrado con KMS
}

enum Plan {
  FREE
  PRO
  AGENCY
}
```

```bash
# Ejecutar migración inicial
cd packages/db
pnpm prisma migrate dev --name init
pnpm prisma generate
```

## Variables de entorno

```bash
# .env.local (apps/web)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:3001

# .env (apps/api)
DATABASE_URL=postgresql://user:password@localhost:5432/contachile
ANTHROPIC_API_KEY=sk-ant-...
FINTOC_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
SII_AMBIENTE=MAULLIN  # MAULLIN (pruebas) o SII (producción)
ENCRYPTION_KEY=...    # Para cifrar certificados digitales
```

## Comandos de desarrollo

```bash
# En la raíz del monorepo:
pnpm dev          # Levanta todos los servicios
pnpm build        # Build de producción
pnpm test         # Tests de todos los paquetes
pnpm lint         # Lint de todo el proyecto

# Por app específica:
pnpm --filter web dev
pnpm --filter api dev
pnpm --filter @contachile/dte test
```

## Setup del motor DTE

```bash
cd packages/dte
pnpm add xmlbuilder2 node-forge
pnpm add -D @types/node vitest
```

```typescript
// packages/dte/src/index.ts
export { generarDTE } from './generators/dte'
export { firmarDTE } from './signer'
export { generarSobre } from './generators/sobre'
export { validarDTE } from './validator'
export { generarPDF } from './pdf'
export type { DTEConfig, TipoDocumento } from './types'
```

## Primer endpoint funcional (API)

```typescript
// apps/api/src/routes/dte/emitir.ts
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { generarDTE, firmarDTE } from '@contachile/dte'

const emitirFacturaSchema = z.object({
  receptorRut: z.string().regex(/^\d{7,8}-[\dkK]$/),
  receptorNombre: z.string(),
  items: z.array(z.object({
    descripcion: z.string(),
    cantidad: z.number().positive(),
    precioUnitario: z.number().positive(),
  })),
  formaPago: z.enum(['CONTADO', 'CREDITO']).default('CONTADO'),
})

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post('/dte/facturas', {
    preHandler: [fastify.authenticate], // JWT middleware
  }, async (request, reply) => {
    const body = emitirFacturaSchema.parse(request.body)
    const { companyId } = request.user

    // 1. Obtener siguiente folio
    const folio = await getNextFolio(companyId, 33)
    
    // 2. Generar XML
    const xml = generarDTE({ tipo: 33, folio, ...body, emisor: company })
    
    // 3. Firmar
    const xmlFirmado = await firmarDTE(xml, company.cert)
    
    // 4. Enviar al SII
    const trackId = await enviarSII(xmlFirmado)
    
    // 5. Guardar en DB
    const documento = await db.documento.create({ data: { xml: xmlFirmado, trackId, ... } })
    
    return reply.code(201).send({ id: documento.id, trackId })
  })
}
```

## Claude Code para acelerar el desarrollo

Instalar Claude Code para usar en el proyecto:

```bash
npm install -g @anthropic-ai/claude-code
claude  # Iniciar en el directorio del proyecto
```

### Usos recomendados de Claude Code en este proyecto:

```bash
# Generar la estructura completa del schema Prisma
claude "Genera el schema Prisma completo para un sistema contable multi-tenant chileno con tablas para: usuarios, empresas, asientos contables, documentos DTE, plan de cuentas, movimientos bancarios y empleados"

# Implementar validador de RUT chileno
claude "Implementa un validador de RUT chileno en TypeScript con módulo 11, incluyendo formateo y tests con Vitest"

# Generar tests de cálculo IVA
claude "Genera tests exhaustivos en Vitest para el cálculo de IVA en documentos tributarios chilenos, incluyendo casos de facturas afectas, exentas, notas de crédito, descuentos y redondeos"

# Implementar generador XML DTE tipo 33
claude "Implementa el generador de XML para DTE tipo 33 (Factura Electrónica) según el esquema XSD del SII chileno, usando la librería xmlbuilder2"
```
