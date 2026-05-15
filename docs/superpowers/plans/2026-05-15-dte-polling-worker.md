# DTE Polling Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar el worker BullMQ de polling DTE al arranque del API y agregar modo simulación que haga que los documentos pasen de `PENDING` a `ACCEPTED` después de N intentos en desarrollo.

**Architecture:** El worker ya existe (`apps/api/src/workers/dte-polling.ts`) pero no se importa en el servidor. Se agrega lógica de simulación que usa `job.attempts` de BullMQ para decidir entre PENDING/ACCEPTED sin consultar transportes. En producción consulta transportes reales.

**Tech Stack:** Fastify, BullMQ, Redis, ioredis, Prisma

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/src/workers/dte-polling.ts` | Modify | Agregar modo simulación con `SIMULATE_DTE_STATUS` y `SIMULATED_ATTEMPTS` |
| `apps/api/src/index.ts` | Modify | Importar worker para inicialización al arranque |
| `apps/api/.env.example` | Modify | Documentar nuevas variables de entorno |

---

### Task 1: Add simulation mode to the polling worker

**Files:**
- Modify: `apps/api/src/workers/dte-polling.ts`

- [ ] **Step 1: Add simulation constants at the top of the file**

Add after the imports, before `initWorker()`:

```typescript
const SIMULATE_DTE_STATUS = process.env.SIMULATE_DTE_STATUS === 'true'
const SIMULATED_ATTEMPTS = parseInt(process.env.SIMULATED_ATTEMPTS || '3', 10)
```

- [ ] **Step 2: Replace the worker job handler with simulation logic**

Replace the entire `new Worker<PollJobData>(...)` block (lines 41-93) with:

```typescript
    new Worker<PollJobData>(
      'dte-polling',
      async (job) => {
        const { documentId, trackId, source } = job.data
        const attempt = job.attemptsMade + 1 // BullMQ uses 0-indexed attemptsMade

        // ── Simulation mode (development only) ─────────────────────────────
        if (SIMULATE_DTE_STATUS) {
          if (attempt < SIMULATED_ATTEMPTS) {
            console.log(`[dte-worker] Simulating PENDING for ${documentId} (attempt ${attempt}/${SIMULATED_ATTEMPTS})`)
            throw new Error(`Simulated PENDING for ${documentId}`)
          }

          console.log(`[dte-worker] Simulating ACCEPTED for ${documentId} (attempt ${attempt}/${SIMULATED_ATTEMPTS})`)

          await prisma.document.update({
            where: { id: documentId },
            data: {
              status: 'ACCEPTED',
              acceptedAt: new Date(),
            },
          })

          const doc = await prisma.document.findUnique({ where: { id: documentId } })
          if (doc?.receiverEmail) {
            await emailService.sendDocumentAccepted({
              documentId: doc.id,
              folio: doc.folio,
              type: doc.type,
              receiverName: doc.receiverName,
              receiverEmail: doc.receiverEmail,
            })
          }

          await prisma.auditLog.create({
            data: {
              documentId,
              action: 'ACCEPTED',
              payload: { source, simulated: true },
            },
          })

          return { documentId, status: 'ACCEPTED', simulated: true }
        }

        // ── Real transport mode (production) ────────────────────────────────
        const statusResult =
          source === 'sii'
            ? await siiClient.queryStatus(trackId)
            : await aceptaClient.queryStatus(trackId)

        if (statusResult.status === 'PENDING') {
          throw new Error(`Document ${documentId} still pending`)
        }

        const newStatus = statusResult.status

        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: newStatus,
            ...(newStatus === 'ACCEPTED'
              ? { acceptedAt: new Date() }
              : newStatus === 'REJECTED'
                ? { rejectedAt: new Date(), rejectionReason: statusResult.detail }
                : {}),
          },
        })

        if (newStatus === 'ACCEPTED') {
          const doc = await prisma.document.findUnique({ where: { id: documentId } })
          if (doc?.receiverEmail) {
            await emailService.sendDocumentAccepted({
              documentId: doc.id,
              folio: doc.folio,
              type: doc.type,
              receiverName: doc.receiverName,
              receiverEmail: doc.receiverEmail,
            })
          }
        }

        await prisma.auditLog.create({
          data: {
            documentId,
            action: newStatus,
            payload: { source, detail: statusResult.detail },
          },
        })

        return { documentId, status: newStatus }
      },
      { connection: redisConnection }
    )
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/workers/dte-polling.ts
git commit -m "$(cat <<'EOF'
feat(api): add DTE polling simulation mode

- SIMULATE_DTE_STATUS env var enables simulated status cycling
- Uses job.attempts to transition PENDING -> ACCEPTED after N retries
- Simulation logs clearly indicate simulated vs real mode

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Import worker in API bootstrap

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add worker import at the top of imports**

Add after the last import (after `import receiversRoute from './routes/receivers'`):

```typescript
import './workers/dte-polling'
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "$(cat <<'EOF'
feat(api): import DTE polling worker on server boot

Worker now initializes when the Fastify server starts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Document environment variables

**Files:**
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Add simulation variables to .env.example**

Append to the file (create if it doesn't exist):

```bash
# ── DTE Polling Simulation (development only) ──
# Set to 'true' to simulate SII/Acepta status transitions without real HTTP calls
SIMULATE_DTE_STATUS=true
# Number of polling attempts before forcing ACCEPTED in simulation mode
SIMULATED_ATTEMPTS=3
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/.env.example
git commit -m "$(cat <<'EOF'
docs(api): document DTE polling simulation env vars

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Verify build

**Files:**
- None (testing only)

- [ ] **Step 1: Build the API**

Run: `pnpm --filter api build`
Expected: Compiles without errors

- [ ] **Step 2: Commit (if any type fixes needed)**

If build fails, fix types and commit before proceeding.

---

### Task 5: Test end-to-end

**Files:**
- None (testing only)

**Prerequisites:**
- Docker Compose running (`docker-compose up -d`) with PostgreSQL and Redis
- `SIMULATE_DTE_STATUS=true` in `apps/api/.env`
- API running (`pnpm --filter api dev`)
- Web running (`pnpm --filter web dev`)

- [ ] **Step 1: Emit a test DTE**

1. Open `http://localhost:3000/emit`
2. Fill: RUT `76.123.456-7`, Name `Test Company`, Address `Santiago`
3. Add item: Description `Test`, Quantity `1`, Unit Price `10000`
4. Click "Emitir DTE"
5. Verify success message with folio number

- [ ] **Step 2: Verify document starts as PENDING**

1. Navigate to `http://localhost:3000/documents`
2. Verify the new document shows status `PENDING`

- [ ] **Step 3: Check worker logs**

In the API terminal, verify logs show:
```
[dte-worker] Simulating PENDING for <id> (attempt 1/3)
```
(repeated for attempts 1 and 2)

- [ ] **Step 4: Wait for ACCEPTED**

After ~10-15 minutes (3 attempts x 5 min backoff), verify:
1. API logs show: `[dte-worker] Simulating ACCEPTED for <id> (attempt 3/3)`
2. Document status in `/documents` changes to `ACCEPTED`
3. `acceptedAt` field is populated in DB

- [ ] **Step 5: Verify audit log**

Query DB:
```sql
SELECT action, payload FROM "AuditLog" WHERE "documentId" = '<id>' ORDER BY "createdAt" DESC;
```
Expected: Row with action = 'ACCEPTED' and payload containing `{"simulated":true}`

- [ ] **Step 6: Verify email stub (if receiver email provided)**

If the emitted document had a receiver email, the `StubEmailService` should have logged the call. Check API logs for email service activity.

---

## Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| Importar worker en index.ts | Task 2 |
| Agregar modo simulación con SIMULATE_DTE_STATUS | Task 1 |
| Usar job.attempts para decidir PENDING/ACCEPTED | Task 1 |
| Documentar variables de entorno | Task 3 |
| Verificar build compila | Task 4 |
| Test end-to-end | Task 5 |

All requirements covered.

## Placeholder Scan

- No TBDs, TODOs, or incomplete sections.
- All code blocks contain complete, copy-pasteable code.
- All commands have expected output.
- Type consistency: `PollJobData`, `SIMULATE_DTE_STATUS`, `SIMULATED_ATTEMPTS` used consistently.
