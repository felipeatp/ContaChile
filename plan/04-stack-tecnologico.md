# Stack Tecnológico y Arquitectura

## Decisiones de stack

### Frontend
| Tecnología | Versión | Razón |
|-----------|---------|-------|
| Next.js | 14 (App Router) | SSR, RSC, excelente DX, deploy en Vercel gratis |
| TypeScript | 5.x | Tipado estático crítico para lógica tributaria |
| Tailwind CSS | 3.x | Utility-first, consistente con shadcn |
| shadcn/ui | latest | Componentes accesibles, sin licencia, customizable |
| React Query | 5.x | Estado servidor, caché, invalidación |
| Zustand | 4.x | Estado cliente ligero |
| React Hook Form + Zod | latest | Formularios de DTE con validación robusta |

### Backend
| Tecnología | Versión | Razón |
|-----------|---------|-------|
| Node.js | 20 LTS | Ecosistema, async, mismo lenguaje que frontend |
| Fastify | 4.x | 2x más rápido que Express, schema validation built-in |
| Prisma | 5.x | ORM type-safe, migraciones, multi-tenant |
| PostgreSQL | 15 | ACID, JSON, multi-schema para tenant isolation |
| Bull/BullMQ | latest | Colas para envío DTE, emails, tareas IA |
| Zod | 3.x | Validación compartida frontend/backend |

### Infraestructura
| Servicio | Plan | Costo |
|----------|------|-------|
| Vercel | Hobby → Pro | $0 → $20/mes |
| Neon (PostgreSQL) | Free → Launch | $0 → $19/mes |
| Railway (API) | Hobby | $5/mes |
| Cloudflare R2 | Free (10GB) | $0 inicio |
| Upstash Redis (Bull) | Free | $0 inicio |

### Servicios externos
| Servicio | Para qué | Costo aprox. |
|----------|----------|-------------|
| Clerk | Auth multi-tenant | $0 inicio (25k MAU gratis) |
| Resend | Email transaccional | $0 (3k/mes gratis) |
| Stripe | Pagos internacionales | 2.9% + $0.30 por transacción |
| WebPay Plus | Pagos locales Chile | 1.49-2.49% por transacción |
| Fintoc | Open banking Chile | ~$0.10 USD por conexión |
| Anthropic Claude | Agentes IA | ~$0.003/1k tokens (Haiku) |
| Sentry | Error tracking | $0 (5k errores/mes) |
| PostHog | Analytics producto | $0 (1M eventos/mes) |

---

## Arquitectura del sistema

### Multi-tenancy

Modelo: **Schema-per-tenant en PostgreSQL**

```
public schema:
  ├── users (id, email, name)
  ├── companies (id, rut, name, user_id)  ← tenant
  └── subscriptions (company_id, plan, status)

tenant_{company_id} schema:
  ├── accounts (plan de cuentas)
  ├── journal_entries (libro diario)
  ├── documents (DTE emitidos/recibidos)
  ├── purchases (compras)
  ├── employees (trabajadores)
  └── ...
```

Ventajas: aislamiento total, backup por empresa, cumplimiento datos personales.

### Estructura del monorepo

```
contachile/
├── apps/
│   ├── web/          ← Next.js 14 (dashboard)
│   ├── api/          ← Fastify (REST API)
│   └── mobile/       ← React Native (Fase 3)
├── packages/
│   ├── dte/          ← Motor DTE, XML, firma (crítico)
│   ├── sii-client/   ← Cliente HTTP para APIs SII
│   ├── db/           ← Prisma schema + client compartido
│   ├── validators/   ← Zod schemas compartidos
│   └── ai-agents/    ← Agentes Claude
└── scripts/
    └── seed/         ← Datos de prueba, plan de cuentas base
```

### Flujo de emisión de DTE

```
Usuario completa formulario
         │
         ▼
Validación Zod (schema)
         │
         ▼
API recibe request → valida tenant
         │
         ▼
packages/dte genera XML según tipo (33/39/52...)
         │
         ▼
Firma digital con certificado del emisor (xmldsig)
         │
         ▼
Genera sobre EnvioDTE
         │
         ▼
POST a api.sii.cl (o maullin para pruebas)
         │
         ▼
Almacena XML + PDF en Cloudflare R2
         │
         ▼
Actualiza estado en DB + notifica usuario
         │
         ▼
Email al receptor (Resend)
```

### Arquitectura de agentes IA

```
Trigger (cron / usuario / evento)
         │
         ▼
Agent Orchestrator (packages/ai-agents)
         │
    ┌────┴────┐
    │         │
    ▼         ▼
Tool calls  Claude API
(DB, SII,   (claude-haiku o
 Fintoc)     claude-sonnet)
    │         │
    └────┬────┘
         │
         ▼
Resultado → DB + notificación usuario
```

---

## Decisiones de arquitectura DTE (críticas)

### Opción A: Librería propia (recomendado)
Desarrollar `packages/dte` desde cero siguiendo los XSD del SII.

**Pros:**
- Control total del proceso
- Sin dependencia de terceros
- Más barato a escala

**Contras:**
- 3-6 semanas de desarrollo inicial
- Proceso de certificación SII propio

### Opción B: Proveedor DTE externo como puente
Usar un proveedor certificado (Acepta.com, Sertigo, TokTok) mientras se desarrolla la librería propia.

**Pros:**
- Lanzamiento en semanas, no meses
- Sin esperar certificación SII

**Contras:**
- Costo: ~$5-15 USD por 100 documentos
- Dependencia externa

**Recomendación:** Usar Opción B para el MVP y Opción A para Fase 2. Así lanzas rápido sin bloqueo de certificación.

---

## Seguridad

### Certificados digitales
- Los certificados digitales de cada empresa se almacenan cifrados (AES-256) en la DB
- La clave de cifrado nunca se almacena junto al certificado
- Usar AWS KMS o Cloudflare KV para gestión de claves

### Datos financieros
- Cifrado en reposo: PostgreSQL con TDE o cifrado a nivel campo (Prisma Encrypt)
- Cifrado en tránsito: TLS 1.3 obligatorio
- Backups: diarios a Cloudflare R2 con retención 90 días

### API
- Rate limiting: 100 req/min por tenant (Fastify rate-limit)
- JWT con rotación de tokens (Clerk maneja esto)
- Audit log de todas las operaciones críticas (emisión DTE, cambio de datos)

---

## Testing

### Estrategia de tests tributarios

Los cálculos tributarios deben tener cobertura del 100% con casos límite:

```typescript
// Ejemplo: test de IVA
describe('Cálculo IVA', () => {
  it('factura afecta estándar: IVA 19%', () => {
    expect(calcularIVA(100_000, 'AFECTA')).toBe(19_000)
  })
  it('factura exenta: IVA 0%', () => {
    expect(calcularIVA(100_000, 'EXENTA')).toBe(0)
  })
  it('nota de crédito reduce IVA correctamente', () => {
    // ...
  })
})
```

### Tests de integración DTE
- Mock del servidor SII para tests de envío
- Validación de XML contra XSD oficial del SII
- Tests de firma digital con certificado de prueba
