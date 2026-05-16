# Conciliación Bancaria — Design Spec (Módulo 5)

## Goal

Sincronizar movimientos bancarios reales (vía Fintoc) y conciliarlos automáticamente contra DTEs/compras o, en su defecto, sugerir un asiento contable usando el clasificador IA existente. El usuario revisa y aprueba con un clic.

Esto convierte la contabilidad manual en automatización real. Es el módulo que cambia la propuesta de valor de "facturador con IA" a "contabilidad asistida".

## Context

- El proyecto ya tiene `clasificarTransaccion(companyId, BankTransaction)` en `@contachile/ai-agents` que devuelve `{clasificacion, codigo_cuenta, tipo, confianza, asiento{debe, haber}, notas}`.
- Libro Diario (Módulo 1A) acepta asientos manuales y automáticos vía `JournalEntry.source`.
- Worker BullMQ + Redis disponibles para polling.
- Patrón de simulación ya usado (`SIMULATE_DTE_STATUS`); replicar para Fintoc.

## Architecture

### Modelos Prisma

```prisma
model BankAccount {
  id            String   @id @default(cuid())
  companyId     String
  externalId    String   // ID del link/account en Fintoc
  institution   String   // "BancoEstado", "Banco de Chile", etc.
  holderName    String
  holderId      String   // RUT del titular
  currency      String   @default("CLP")
  lastSyncAt    DateTime?
  createdAt     DateTime @default(now())
  movements     BankMovement[]

  @@unique([companyId, externalId])
  @@index([companyId])
}

enum BankMovementType {
  CREDIT   // abono (entrada)
  DEBIT    // cargo (salida)
}

enum BankMovementStatus {
  PENDING        // sin procesar
  SUGGESTED      // IA sugirió clasificación
  MATCHED_DTE    // matcheado a un Document
  MATCHED_PURCHASE  // matcheado a una Purchase
  RECONCILED     // asiento creado
  IGNORED        // usuario lo marcó como no relevante
}

model BankMovement {
  id                  String              @id @default(cuid())
  companyId           String
  bankAccountId       String
  externalId          String              // ID en Fintoc
  postedAt            DateTime
  amount              Int                 // CLP enteros
  currency            String              @default("CLP")
  type                BankMovementType
  description         String
  counterpartRut      String?
  counterpartName     String?
  status              BankMovementStatus  @default(PENDING)
  suggestionPayload   Json?               // resultado del clasificador IA
  matchedDocumentId   String?             // FK a Document si coincide con DTE emitido
  matchedPurchaseId   String?             // FK a Purchase si coincide con compra
  journalEntryId      String?             // FK a JournalEntry creado al reconciliar
  createdAt           DateTime            @default(now())

  bankAccount         BankAccount         @relation(fields: [bankAccountId], references: [id])

  @@unique([bankAccountId, externalId])
  @@index([companyId, status])
  @@index([postedAt])
}
```

No agrego FK estricta a Document/Purchase/JournalEntry para no complicar borrado en cascada (uso strings con check manual).

### Package `@contachile/fintoc-client`

Nuevo paquete con:

```typescript
export interface FintocConfig {
  apiKey?: string
  baseURL?: string
  simulate?: boolean
}

export interface FintocAccount {
  externalId: string
  institution: string
  holderName: string
  holderId: string
  currency: string
}

export interface FintocMovement {
  externalId: string
  postedAt: Date
  amount: number
  type: 'CREDIT' | 'DEBIT'
  description: string
  counterpartRut?: string
  counterpartName?: string
}

export class FintocClient {
  constructor(config: FintocConfig)
  async listAccounts(linkToken: string): Promise<FintocAccount[]>
  async listMovements(linkToken: string, accountId: string, from: Date, to: Date): Promise<FintocMovement[]>
}
```

**Modo simulador** (`simulate: true` o `FINTOC_USE_REAL !== 'true'`):

- `listAccounts` retorna 1 cuenta fija: `BancoSimulado / Empresa Test / RUT empresa`
- `listMovements` genera N movimientos sintéticos deterministas:
  - 2 CREDIT que coinciden con DTEs emitidos (mismo monto, mismo RUT receptor) → testeable matching
  - 2 DEBIT que coinciden con Compras (mismo monto, mismo RUT emisor) → testeable matching
  - 1 DEBIT sin match (gasto suelto) → testeable clasificación IA

**Modo real:** llamada a `https://api.fintoc.com/v1/links/.../accounts` etc. con `Authorization: Bearer <api-key>`. Lo dejamos como esqueleto con TODO; las llamadas exactas dependen de la versión de la API.

### Endpoints

| Método | Path | Descripción |
|--------|------|-------------|
| GET    | `/bank/accounts` | Lista BankAccounts de la empresa |
| POST   | `/bank/accounts/sync` | Sincroniza movimientos (usa simulador o Fintoc real). Body: `{ bankAccountId?, from?, to? }` |
| GET    | `/bank/movements?status=&from=&to=` | Lista movimientos con filtros |
| POST   | `/bank/movements/:id/match-auto` | Busca DTE/Compra coincidente (monto + RUT + ventana de 7 días). Si encuentra, marca MATCHED_DTE o MATCHED_PURCHASE. |
| POST   | `/bank/movements/:id/classify` | Llama al clasificador IA, guarda en `suggestionPayload`, marca SUGGESTED |
| POST   | `/bank/movements/:id/reconcile` | Crea JournalEntry. Body: `{ debitAccountId, creditAccountId, description? }`. Marca RECONCILED. |
| POST   | `/bank/movements/:id/ignore` | Marca IGNORED |

### Lógica de matching automático

```
movimiento CREDIT con counterpartRut R y monto M
  → busca Document WHERE companyId=X AND receiverRut=R AND totalAmount=M AND emittedAt BETWEEN [postedAt-7d, postedAt+7d]
  → si encuentra exactamente uno: matchedDocumentId, status=MATCHED_DTE

movimiento DEBIT con counterpartRut R y monto M
  → busca Purchase WHERE companyId=X AND issuerRut=R AND totalAmount=M AND date BETWEEN [postedAt-7d, postedAt+7d]
  → si encuentra exactamente uno: matchedPurchaseId, status=MATCHED_PURCHASE
```

Si no encuentra match exacto, retorna 200 con `{matched: false}` y deja el movimiento PENDING.

### Lógica de conciliación final

Cuando el usuario aprueba (POST /reconcile):
- Crea JournalEntry con `source='bank'`, sourceId=movement.id
- Líneas: 1 débito + 1 crédito con las cuentas elegidas
- Actualiza movement.status=RECONCILED, journalEntryId=entry.id

Para movements ya MATCHED_DTE/MATCHED_PURCHASE: el matching es solo informativo (el asiento del DTE/Compra ya existe). En este caso, status pasa a RECONCILED sin crear otro JournalEntry — el cliente sabe que la reconciliación es por reflejo del asiento ya existente. (Decisión MVP: no creamos asiento bancario duplicado.)

### Worker opcional (futuro)

Por ahora **no creamos worker** automático: el usuario invoca `POST /bank/accounts/sync` desde la UI cuando quiere. Esto evita complejidad de cron + manejo de errores en background.

## UI

`/banco/conciliacion`:
- Sección "Cuentas": lista BankAccounts, botón "Sincronizar movimientos" por cada una
- Tabs: PENDIENTES / SUGERIDOS / MATCHED / CONCILIADOS / IGNORADOS
- Tabla con fecha, descripción, monto, contraparte, estado, sugerencia IA si existe
- Acciones por fila: Buscar match (auto), Sugerir con IA, Conciliar manual, Ignorar

Modal "Conciliar manual":
- Select de cuenta DEBE (todas las del PUC)
- Select de cuenta HABER
- Pre-llenadas según sugerencia IA si existe
- Botón "Crear asiento"

## Sidebar

Entrada nueva "Conciliación bancaria" cerca de Libro Diario.

## Error Handling

| Escenario | Comportamiento |
|----------|----------|
| Fintoc API key faltante en modo real | Fallback a simulador con warning |
| Movimiento ya conciliado | POST /reconcile 400 "Ya conciliado" |
| Cuentas inválidas en /reconcile | 400 con mensaje claro |
| Matching ambiguo (2+ candidatos) | Devuelve la lista, no auto-matchea |

## Testing Strategy

Smoke test `smoke-banking.ts`:

1. Asegurar BankAccount existe
2. Sincronizar movimientos simulados → debe crear 5
3. Para 2 movimientos CREDIT que coinciden con DTEs existentes: `match-auto` → MATCHED_DTE
4. Para 1 movimiento DEBIT que coincide con Compra: `match-auto` → MATCHED_PURCHASE
5. Para 2 movimientos sin match: `classify` → SUGGESTED (sin llamar al modelo real, usar mock)
6. Conciliar un movimiento PENDING manualmente → JournalEntry creado, status RECONCILED

## Future Work (out of scope)

- OAuth widget de Fintoc en el frontend (link real con auth del usuario).
- Worker BullMQ con cron `0 */6 * * *` para sincronizar cada 6 horas.
- Notificaciones push si llegan movimientos importantes (>X CLP).
- Conciliación bancaria masiva: aprobar todos los sugeridos con confianza > 0.8 con un clic.
- Reportes: cobertura de conciliación (% movimientos reconciliados).
- Detección de fraude: movimientos sin DTE/Compra que sumen >Y CLP.
