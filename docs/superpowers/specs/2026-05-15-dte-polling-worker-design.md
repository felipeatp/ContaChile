# DTE Polling Worker Design

## Goal

Conectar el worker BullMQ existente al arranque del API para que procese jobs de polling de estado DTE, y agregar modo simulación para desarrollo local donde los documentos pasen de `PENDING` a `ACCEPTED` después de N intentos.

## Context

El proyecto ya tiene:

- **Queue** (`apps/api/src/queues/dte.ts`): encola jobs `poll-status` con `{documentId, trackId, source}`
- **Worker** (`apps/api/src/workers/dte-polling.ts`): implementado pero **no importado** en `index.ts`. Consulta transportes SII/Acepta, actualiza DB, envía email, crea audit log.
- **Transportes** (`packages/transport-sii/`, `packages/transport-acepta/`): stubs que siempre retornan `PENDING`

El problema: si conectamos el worker tal como está, los stubs causan reintentos infinitos (siempre PENDING).

## Architecture

```
API Server (Fastify)
  ├─ import './workers/dte-polling'  ← NUEVO: arranca worker al boot
  │
  └─ POST /dte/emit
       └─ enqueuePollJob({documentId, trackId, source})
            └─ BullMQ Queue 'dte-polling' (Redis)
                   └─ Worker consume job cada 5 min (backoff fixed)
                          ├─ job.attempts < SIMULATED_ATTEMPTS ? throw (reintenta)
                          ├─ job.attempts >= SIMULATED_ATTEMPTS → ACCEPTED
                          └─ update DB + email + audit log
```

## Simulation Mode

En desarrollo (`SIMULATE_DTE_STATUS=true`), el worker usa el contador de intentos de BullMQ (`job.attempts`) en lugar del transporte real para decidir el estado:

| `job.attempts` | Estado resultante |
|---------------|-------------------|
| 1, 2          | PENDING (throw → reintento con backoff 5 min) |
| >= 3          | ACCEPTED |

En producción (`SIMULATE_DTE_STATUS` no definido o `false`), el worker consulta el transporte real y respeta su respuesta.

## Components

### Worker (`apps/api/src/workers/dte-polling.ts`)

Modificaciones:
1. Leer `SIMULATE_DTE_STATUS` del environment
2. Antes de consultar el transporte, verificar si simulación está activa
3. Si simulación activa: usar `job.attempts` para decidir estado
4. Si simulación inactiva: comportamiento actual (consulta transporte)

### API Bootstrap (`apps/api/src/index.ts`)

Agregar `import './workers/dte-polling'` para que el worker se inicialice al arrancar el servidor.

### Queue (`apps/api/src/queues/dte.ts`)

Sin cambios. La cola ya configura:
- `attempts: 24`
- `backoff: {type: 'fixed', delay: 5 * 60 * 1000}` (5 minutos)
- `removeOnComplete: true`
- `removeOnFail: false`

## Data Flow

1. Usuario emite DTE → `POST /dte/emit` o `POST /dte/emit-bridge`
2. API crea documento en DB con `status: PENDING`
3. API llama `enqueuePollJob({documentId, trackId, source})`
4. BullMQ encola job con retry cada 5 min
5. Worker consume job:
   - Simulación activa + attempts < 3 → throw Error → BullMQ reintenta en 5 min
   - Simulación activa + attempts >= 3 → marca ACCEPTED
   - Simulación inactiva → consulta transporte real
6. Worker actualiza DB:
   - `status: ACCEPTED`, `acceptedAt: new Date()`
   - o `status: REJECTED`, `rejectedAt`, `rejectionReason`
7. Si ACCEPTED y tiene email receptor → envía notificación
8. Crea registro en `auditLog`

## Error Handling

| Escenario | Comportamiento |
|-----------|---------------|
| Redis no disponible | Worker no arranca, warning en log. Emisiones funcionan sin polling. |
| Job falla > 24 intentos | BullMQ lo mantiene en failed. Se puede revisar y reintentar manualmente. |
| Email service no configurado | Usa `StubEmailService`, logea la llamada sin enviar email real. |
| Transporte retorna error inesperado | Job falla, BullMQ reintenta con backoff. |

## Environment Variables

| Variable | Default | Descripción |
|----------|---------|-------------|
| `SIMULATE_DTE_STATUS` | `false` | Si `true`, simula ciclo PENDING → ACCEPTED vía `job.attempts` |
| `SIMULATED_ATTEMPTS` | `3` | Número de intentos antes de forzar ACCEPTED en modo simulación |
| `REDIS_HOST` | `localhost` | Host de Redis para BullMQ |
| `REDIS_PORT` | `6379` | Puerto de Redis |

## Testing Strategy

1. **Emitir DTE** → verificar que `enqueuePollJob` encola job en Redis
2. **Verificar job encolado** → `bullmq` UI o logs del worker
3. **Verificar ciclo de simulación** → documento pasa de PENDING → ACCEPTED después de ~10-15 minutos (3 intentos × 5 min)
4. **Verificar email stub** → `StubEmailService.calls` contiene la llamada de notificación
5. **Verificar audit log** → registro creado con acción `ACCEPTED`

## Migration / Rollout

No requiere migración de DB. Solo cambios de código:
1. Modificar `workers/dte-polling.ts`
2. Agregar import en `index.ts`
3. Setear `SIMULATE_DTE_STATUS=true` en `.env` de dev

## Future Work (out of scope)

- Implementar transporte Acepta real (HTTP a api.acepta.com)
- Implementar transporte SII real (HTTPS a maullin.sii.cl)
- WebSocket/SSE para notificar al frontend cuando cambia el estado
- UI de audit trail para ver logs de cambio de estado
