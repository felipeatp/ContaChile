# Alertas de Vencimiento — Design Spec (Módulo 3)

## Goal

Implementar un sistema de recordatorios automáticos por email para los vencimientos tributarios chilenos críticos. Si el cliente paga el F29 atrasado porque ContaChile no avisó, culpa al software. Esto es retención básica.

Cobertura: cotizaciones previsionales (día 10), retención de honorarios (día 12), F29 (día 20). Más DDJJ 1887 y F22 anuales.

## Context

El proyecto ya tiene:
- BullMQ + Redis configurado (worker `dte-polling` ya en producción).
- `createEmailService()` con `ResendEmailService` (prod) y `StubEmailService` (dev sin API key).
- `F29Alert` en el dashboard con UI hardcodeada que se reemplazará por un banner genérico que liste todos los vencimientos próximos.
- Multi-tenant por `companyId`.

## Architecture

### Modelo Prisma

```prisma
model AlertSent {
  id         String   @id @default(cuid())
  companyId  String
  alertCode  String     // 'F29' | 'COTIZACIONES' | 'RETENCION_HONORARIOS' | 'DDJJ_1887' | 'F22'
  dueDate    DateTime   // fecha de vencimiento original
  daysBefore Int        // cuántos días antes se envió (5 o 1, o 0 si fue vencimiento)
  sentAt     DateTime  @default(now())

  @@unique([companyId, alertCode, dueDate, daysBefore])
  @@index([companyId])
  @@index([sentAt])
}
```

Usa el unique compuesto para dedup: un mismo (empresa, alerta, vencimiento, daysBefore) no se manda dos veces.

### Calendario de vencimientos (constante)

```typescript
// packages/validators/src/vencimientos.ts
export interface VencimientoConfig {
  code: 'F29' | 'COTIZACIONES' | 'RETENCION_HONORARIOS'
  label: string
  dayOfMonth: number
  description: string
  link: string  // ruta del frontend
}

export const VENCIMIENTOS_MENSUALES: VencimientoConfig[] = [
  {
    code: 'COTIZACIONES',
    label: 'Cotizaciones previsionales',
    dayOfMonth: 10,
    description: 'Pago de cotizaciones previsionales (PreviRed)',
    link: '/remuneraciones/exportaciones',
  },
  {
    code: 'RETENCION_HONORARIOS',
    label: 'Retención de honorarios',
    dayOfMonth: 12,
    description: 'Pago de retención sobre boletas de honorarios recibidas (13.75%)',
    link: '/f29',
  },
  {
    code: 'F29',
    label: 'F29 (IVA mensual)',
    dayOfMonth: 20,
    description: 'Declaración y pago F29',
    link: '/f29',
  },
]

// DDJJ 1887 y F22 son anuales; los manejamos como casos especiales con fechas absolutas
```

### Regla de fin de semana

Si `dayOfMonth` cae en sábado o domingo, el vencimiento se traslada al **siguiente lunes hábil**. Implementar con helper puro:

```typescript
function adjustForWeekend(date: Date): Date {
  const day = date.getDay() // 0=Sun, 6=Sat
  if (day === 0) {
    const adjusted = new Date(date)
    adjusted.setDate(date.getDate() + 1)
    return adjusted
  }
  if (day === 6) {
    const adjusted = new Date(date)
    adjusted.setDate(date.getDate() + 2)
    return adjusted
  }
  return date
}
```

### Helper `findUpcomingDueDates`

Dado `today`, devuelve los vencimientos del mes actual y siguiente (por si el día 10 ya pasó, mostrar el del mes siguiente). Cada entrada incluye `code`, `dueDate` (ajustada por fin de semana), `daysUntil`.

```typescript
export interface UpcomingAlert {
  code: string
  label: string
  description: string
  dueDate: Date
  daysUntil: number
  link: string
}

export function findUpcomingDueDates(today: Date, monthsAhead = 1): UpcomingAlert[] { ... }
```

Filtra los que ya pasaron pero permite también incluir uno vencido (último día) con `daysUntil < 0` para mostrar warning urgente.

### Worker BullMQ

Nuevo worker `apps/api/src/workers/alerts.ts`:

```typescript
import { Worker } from 'bullmq'

new Worker(
  'alerts-daily',
  async () => {
    // Para cada empresa activa
    const companies = await prisma.company.findMany()
    for (const company of companies) {
      const today = new Date()
      const upcoming = findUpcomingDueDates(today)

      for (const alert of upcoming) {
        // Solo enviar si daysUntil ∈ {5, 1}
        if (![5, 1].includes(alert.daysUntil)) continue

        // Verificar dedup
        const already = await prisma.alertSent.findUnique({
          where: {
            companyId_alertCode_dueDate_daysBefore: {
              companyId: company.id,
              alertCode: alert.code,
              dueDate: alert.dueDate,
              daysBefore: alert.daysUntil,
            },
          },
        })
        if (already) continue

        // Enviar email
        if (company.email) {
          await emailService.sendDueAlert({
            recipientEmail: company.email,
            recipientName: company.name,
            alert,
          })
        }

        // Registrar
        await prisma.alertSent.create({ data: { ... } })
      }
    }
  },
  { connection: redisConnection }
)
```

Se programa via BullMQ Queue con repeat cron `0 8 * * *` (diariamente a las 08:00). Cuando Redis no está disponible, el worker no arranca (igual que dte-polling).

### Email template

`packages/api/src/lib/email.ts` extiende con `sendDueAlert`:

```typescript
async sendDueAlert(params: { recipientEmail: string; recipientName: string; alert: UpcomingAlert }) {
  await this.resend.emails.send({
    from: this.from,
    to: params.recipientEmail,
    subject: `⏰ ${params.alert.label} vence ${formatDate(params.alert.dueDate)}`,
    html: `
      <h2>Recordatorio de vencimiento</h2>
      <p>Hola <strong>${params.recipientName}</strong>,</p>
      <p>Te avisamos que <strong>${params.alert.label}</strong> vence el <strong>${formatDate(params.alert.dueDate)}</strong> (en ${params.alert.daysUntil} días).</p>
      <p>${params.alert.description}</p>
      <p><a href="${APP_URL}${params.alert.link}">Ir a ${params.alert.label}</a></p>
    `,
  })
}
```

### API endpoint

`GET /alerts/upcoming` → devuelve la lista de `UpcomingAlert[]` calculada para today, sin enviar emails. El frontend lo consume para el banner del dashboard.

Filtros opcionales: `?daysAhead=15` (cuántos días hacia adelante mirar).

### UI

Reemplazar `F29Alert` por `UpcomingAlertsBanner` que muestra lista de vencimientos próximos (los que faltan ≤ 7 días o ya vencieron pero <30d).

- Verde: faltan > 5 días (informativo, no se muestra por defecto).
- Amarillo: faltan ≤ 5 días.
- Rojo: vencido (daysUntil < 0).

Cada item: label, fecha de vencimiento, "Faltan X días" / "Vencido hace X días", link al módulo correspondiente.

## Error Handling

| Escenario | Comportamiento |
|----------|----------|
| Empresa sin email configurado | No envía email pero registra alerta para que el banner UI funcione |
| Redis caído | Worker no inicia; banner sigue funcionando vía API |
| Resend API error | Catch + log; no falla el job; retry en próximo run (sin email duplicado por dedup) |
| Worker corrió 2 veces el mismo día | Dedup por (companyId, alertCode, dueDate, daysBefore) evita doble email |

## Testing Strategy

Smoke test `smoke-alerts.ts`:

1. Verificar `findUpcomingDueDates(new Date('2026-05-15'))` retorna F29 (día 20) con `daysUntil=5`.
2. Verificar `findUpcomingDueDates(new Date('2026-04-09'))` retorna COTIZACIONES (día 10) con `daysUntil=1`.
3. Weekend rollover: día 10 marzo 2026 es martes → no cambia. Día 10 mayo 2026 cae domingo → 11 (lunes).
4. Dedup: insertar AlertSent y llamar al helper de envío → debe skipear.
5. Endpoint /alerts/upcoming devuelve estructura correcta.

## Future Work (out of scope)

- Configuración por empresa: cuáles alertas escuchar, cuántos días antes (3, 5, 10...).
- Notificación in-app (campana con badge en header).
- SMS via Twilio para alertas críticas.
- DDJJ 1887 y F22 con fechas anuales fijas (marzo / abril).
- Webhook hacia Slack / Discord.
- Snooze: posponer una alerta 1 día.
