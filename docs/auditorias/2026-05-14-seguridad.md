# Auditoria de Seguridad - ContaChile

**Fecha:** 2026-05-14
**Rama:** feat/dte-engine
**Scope:** apps/web, apps/api, packages/validators, packages/dte, packages/db

---

## Resumen Ejecutivo

El proyecto tiene una arquitectura moderna (Next.js 14 + Fastify + Prisma + Clerk) con buenas practicas base, pero presenta **vulnerabilidades criticas de autorizacion** que permiten acceso a documentos entre tenants, **exposicion de secrets en el repositorio**, y **falta de headers de seguridad** esenciales.

No se detectaron vulnerabilidades de SQL Injection ni XSS directas gracias al uso de Prisma y React.

---

## Vulnerabilidades Criticas

### 1. Broken Access Control - Documents endpoint no filtra por companyId (IDOR)

**Severidad:** Critico
**Archivos:**
- `apps/api/src/routes/dte/documents.ts`
- `apps/api/src/routes/dte/emit.ts` (idempotency sin companyId)
- `apps/api/src/routes/dte/emit-bridge.ts` (idempotency sin companyId)
- `apps/api/src/routes/dte/pdf.ts`

**Descripcion:** Los endpoints `GET /documents`, `GET /documents/:id`, y `GET /documents/:id/pdf` no filtran por `companyId`. Cualquier usuario autenticado puede listar, ver y descargar PDFs de documentos de **cualquier tenant**.

**Fix:**
```typescript
// documents.ts
const where: Record<string, unknown> = { companyId: request.companyId }

// documents/:id
const document = await prisma.document.findUnique({
  where: { id, companyId: request.companyId },
  include: { items: true },
})
```

**Nota:** El schema Prisma actual no tiene `companyId` en `Document`. Se requiere migracion.

### 2. Secrets Hardcodeados en .env Commiteados al Repo

**Severidad:** Critico
**Archivos:**
- `apps/api/.env`
- `apps/web/.env.local`

**Secrets expuestos:**
- `CLERK_SECRET_KEY=sk_test_uxvUBHEBdZadtLx4HdhmI6VWoTVCYFPbZx7aungQSp`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Ym9sZC1rb2FsYS0zOS5jbGVyay5hY2NvdW50cy5kZXYk`

**Fix inmediato:**
1. Rotar las keys en Clerk Dashboard
2. Remover del historial de git: `git filter-branch` o `git filter-repo`
3. Forzar push
4. Verificar `.gitignore` tiene `.env` y `.env.local`

---

## Vulnerabilidades Altas

### 3. Tenant Plugin - Fallback Inseguro a x-company-id Header

**Severidad:** Alto
**Archivo:** `apps/api/src/plugins/tenant.ts` (lineas 31-35)

**Descripcion:** Cuando no hay `Authorization: Bearer` valido, el plugin acepta **cualquier** valor en el header `x-company-id` sin validacion.

**Fix:**
```typescript
// Opcion A: Requerir Clerk SIEMPRE en produccion
if (!clerkSecret && process.env.NODE_ENV === 'production') {
  return reply.code(500).send({ error: 'Authentication misconfigured' })
}

// NUNCA aceptar x-company-id sin autenticacion real
```

### 4. Email HTML Injection (XSS via Email)

**Severidad:** Alto
**Archivo:** `apps/api/src/lib/email.ts`

**Descripcion:** El email service inserta `params.receiverName` directamente en HTML sin sanitizacion.

**Fix:**
```typescript
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
```

### 5. PDF Generation - XML Injection en renderPDF

**Severidad:** Alto
**Archivo:** `apps/api/src/routes/dte/pdf.ts`

**Descripcion:** El endpoint construye XML concatenando strings con datos de la DB sin escapar caracteres especiales XML.

**Fix:**
```typescript
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
```

### 6. Falta de Headers de Seguridad en Fastify

**Severidad:** Alto
**Archivo:** `apps/api/src/index.ts`

**Faltan:**
- CORS (cualquier origen puede hacer requests)
- Content-Security-Policy
- X-Frame-Options
- HSTS
- X-Content-Type-Options

**Fix:**
```typescript
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'

await app.register(cors, {
  origin: process.env.WEB_URL || 'http://localhost:3000',
  credentials: true,
})

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
})
```

---

## Vulnerabilidades Medias

### 7. Rate Limiting Insuficiente

**Severidad:** Medio
**Archivo:** `apps/api/src/index.ts`

**Problema:** Rate limit global de 100 req/min sin diferenciar endpoints. Emision de DTE deberia tener limite mas estricto.

### 8. Falta de Validacion de companyId en Schema Prisma

**Severidad:** Medio
**Archivo:** `packages/db/prisma/schema.prisma`

**Problema:** El modelo `Document` no tiene relacion con `Company`.

### 9. RUT Validation Regex Incompleta

**Severidad:** Medio
**Archivo:** `packages/validators/src/rut.ts`

**Problema:** Inconsistencia entre `validateRUT` y el schema Zod.

### 10. Timeout Corto en apiFetch Puede Causar DoS

**Severidad:** Medio
**Archivo:** `apps/web/lib/api-server.ts`

**Problema:** Timeout de 3 segundos es muy corto para operaciones de emision DTE.

---

## Lo que esta bien

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| SQL Injection | Protegido | Uso de Prisma ORM, sin raw queries |
| XSS en Frontend | Protegido | React escapa automaticamente |
| Input Validation | Parcial | Zod schemas en endpoints de escritura |
| Auth Framework | Bueno | Clerk para autenticacion |
| Idempotency | Implementado | Keys de idempotencia en endpoints |
| Password Storage | N/A | Clerk maneja passwords |

---

## Recomendaciones Prioritarias

### Inmediato (antes de cualquier deploy)
1. Rotar secrets expuestos y remover del historial Git
2. Agregar `companyId` a todas las queries de documentos
3. Deshabilitar fallback a `x-company-id` sin autenticacion

### Antes de MVP
4. Implementar CORS restrictivo y headers de seguridad
5. Sanitizar HTML en emails y XML en PDFs
6. Agregar rate limiting diferenciado por endpoint

### Post-MVP
7. Implementar schema-per-tenant en PostgreSQL
8. Auditar flujo de certificados digitales
9. Implementar logging de seguridad
