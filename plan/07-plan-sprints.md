# Plan de Sprints — ContAI (post auditoría 2026-06-01)

> Orden: primero por criticidad (seguridad > bloqueadores > funcional), luego por impacto en experiencia de usuario para personas sin experiencia técnica.
> Cada sprint es ~2 semanas de trabajo.

---

## Sprint 5 — Seguridad Crítica + Fix Bloqueadores IA
**Objetivo**: Eliminar vulnerabilidades de seguridad y arreglar lo que está roto.
**Por qué primero**: No lanzar a producción con un certificado SII expuesto ni con el agente F22 completamente roto.

### Backend: Seguridad
- [ ] **Eliminar fallback `certPassword` plaintext** en `emit.ts:72` y `envio-dte.ts:40`
- [ ] **Implementar RBAC**: middleware `requireRole('owner'|'admin')` en rutas de certificado, API keys y webhooks
- [ ] **Validar scopes en API keys**: whitelist + registrar user ID en creación
- [ ] **Validar certificado al subir**: `extractPrivateKeyFromPfx()` + verificar RUT coincide con empresa
- [ ] **Rate limiting** en POST `/api-keys`, POST `/company/certificate`, POST `/webhooks`
- [ ] **Errores de workers logeados**: `fastify.log.error()` en todos los catch de `alerts.ts` y `dte-polling.ts`

### IA: Fix bloqueadores
- [ ] **Unificar AgentEvent format**: arreglar mismatch `type` vs `kind` en `base-agent.ts:35-37` — F22 nunca funciona sin esto
- [ ] **Persistencia de conversaciones**: modelo `AgentConversation` en Prisma, endpoint GET historial, migrar `use-consultor.ts` de `useState` a llamada a API
- [ ] **Reescribir prompts del consultor**: lenguaje de dueño de PYME, ejemplos con montos concretos en CLP, urgencia con días faltantes, "por qué" de cada obligación

### Tests de este sprint
- [ ] Test: AgentEvent unificado funciona para todos los agentes
- [ ] Test: `requireRole` bloquea viewer en rutas críticas
- [ ] Test: certificado inválido rechazado al subir
- [ ] Test: conversación persiste tras reload

---

## Sprint 6 — UX No-Técnicos: Formularios y Feedback
**Objetivo**: Hacer la app usable para dueños de PYME y contadores sin experiencia técnica.
**Por qué segundo**: Los problemas de UX son lo que hace que un cliente se vaya a Nubox en la primera semana.

### Frontend: Sistema de feedback
- [ ] **Toast notifications (Sonner)**: reemplazar todos los `alert()` en `document-table.tsx`, `header.tsx` y cualquier otro
- [ ] **Loading states consistentes**: un solo patrón (spinner + `aria-busy`) en toda la app
- [ ] **Botones consistentes**: "Cancelar" en todos los modales, sin variaciones

### Frontend: Validaciones de formularios
- [ ] **Remuneraciones/trabajadores**: migrar a `react-hook-form` + `zod` con validación de RUT en tiempo real, sueldo > 0, confirmación antes de eliminar
- [ ] **Remuneraciones/liquidaciones**: confirmación antes de "Generar mes", selects del design system, historial de períodos
- [ ] **Honorarios**: unificar patrón de formulario
- [ ] **Todos los formularios**: usar `Field` + `Label` del design system, mensajes de error en línea

### Frontend: Tooltips y ayuda contextual
- [ ] **F29/F22**: tooltip en cada código SII (ej: "Código 502 = IVA que cobraste a tus clientes este mes")
- [ ] **DTE emisión**: tooltip en "Bridge · Acepta" explicando qué es sin jerga técnica
- [ ] **Formulario emisión**: hint text en cada campo (ej: "RUT sin puntos, con guión")

### Tests de este sprint
- [ ] Test E2E: RUT inválido en formulario trabajador muestra error en línea (no alert)
- [ ] Test E2E: "Generar mes" sin confirmación no genera duplicado

---

## Sprint 7 — Tests Críticos Tier 1 (Cálculos Tributarios)
**Objetivo**: Cubrir todos los cálculos que afectan dinero real de los clientes.
**Por qué tercero**: Un error en nómina o F29 puede significar multas del SII para el cliente.

- [ ] **`packages/validators/tests/payroll.test.ts`** (nuevo): calcularLiquidacion con AFP CAPITAL, FONASA, ISAPRE, 8 brackets impuesto único, cesantía solo en indefinido, liquidación negativa
- [ ] **`packages/validators/tests/tax.test.ts`** (extender): IVA negativo, cero, extremos, millones de CLP
- [ ] **`packages/validators/tests/rut.test.ts`** (extender): todos los DV (0-9, K), RUT máximo
- [ ] **`apps/api/tests/f22-calculations.test.ts`** (nuevo): 8 brackets, renta negativa, PPM acumulado mayor a impuesto
- [ ] **`apps/api/tests/f29-calculations.test.ts`** (nuevo): débito vs crédito, remanente, exento vs afecto
- [ ] **`packages/dte/tests/signer.test.ts`** (extender): tampering detectado, certificado expirado rechazado
- [ ] **`apps/api/tests/security/multi-tenancy.test.ts`** (nuevo): usuario A no ve datos empresa B bajo ningún escenario
- [ ] **Configurar vitest con coverage thresholds**: `lines: 80` en packages/validators y packages/dte

---

## Sprint 8 — DTE + Chat IA: UX de Flujos Principales
**Objetivo**: Los dos flujos más usados deben ser impecables.

### DTE Emisión
- [ ] **Modal de preview antes de emitir**: resumen (receptor, ítems, totales, IVA) con botón "Confirmar y emitir"
- [ ] **Validación RUT en tiempo real**: mientras escribe (debounce 500ms), indicador verde/rojo
- [ ] **Mensaje de error SII específico**: código de rechazo con explicación en lenguaje simple
- [ ] **Endpoint re-firmar documentos fallidos**: POST `/documents/:id/re-sign`

### Chat IA / Consultor
- [ ] **UI del historial**: timestamps reales, avatares distintos (usuario vs IA), botón copiar respuesta
- [ ] **Selector de conversaciones**: lista de conversaciones anteriores por fecha
- [ ] **Disclaimer visible**: "Este consultor es orientativo — confirma con tu contador para decisiones importantes"
- [ ] **Ampliar `buildContextSnapshot`**: comparación mes actual vs mismo mes año anterior, próximas obligaciones en 30 días

### Tests de este sprint
- [ ] Test E2E: flujo completo emitir DTE con preview — datos correctos
- [ ] Test E2E: conversar con consultor, recargar página, historial aparece
- [ ] Test: re-firmar documento fallido genera XML correcto

---

## Sprint 9 — Tests Críticos Tier 2 + CI Gate
**Objetivo**: 60%+ de cobertura y bloquear regresiones en CI.

- [ ] **`apps/api/tests/lib/accounting-entries.test.ts`** (nuevo): DTE genera asiento Clientes/Ventas/IVA correcto
- [ ] **`apps/api/tests/lib/payroll-service.test.ts`** (nuevo): generación mensual completa
- [ ] **`apps/api/tests/lib/financial-statements.test.ts`** (nuevo): balance cuadra, PyG correcto
- [ ] **`apps/api/tests/lib/bank-service.test.ts`** (nuevo): conciliación detecta diferencias de 1 CLP
- [ ] **`apps/api/tests/lib/inventory-service.test.ts`** (nuevo): stock no puede ser negativo
- [ ] **`apps/api/tests/routes/payroll.test.ts`** (nuevo): endpoints generación y listado
- [ ] **`apps/api/tests/routes/accounting/reports.test.ts`** (nuevo): balance general, PyG
- [ ] **`apps/api/tests/dte/folio-concurrency.test.ts`** (extender): 10 requests simultáneos sin folio duplicado
- [ ] **GitHub Actions workflow**: correr tests en cada PR, bloquear merge si cobertura < 60%
- [ ] **Migrar `f22.test.ts`** de mocks a DB real (SQLite in-memory)

---

## Sprint 10 — Performance + Tabla de Documentos
**Objetivo**: La app no puede trabarse con datos reales de clientes.

### Backend: Performance
- [ ] **N+1 F22**: refactorizar `f22.ts:79-94` con `groupBy` + agregación (1 query en lugar de 12)
- [ ] **Paginación en endpoints**: `inventory/products`, `inventory/movements`, `quotes`, `accounting/journal` — limit/offset, default 50
- [ ] **Índices BD**: `BankMovement@@index([companyId, status])`, `Document@@index([companyId, status, emittedAt])`, `JournalLine@@index([accountId, journalEntryId])`
- [ ] **Validación de fechas en queries**: `z.coerce.date()` en `purchases.ts`, `accounting/journal.ts`, `bank.ts`
- [ ] **Cachear `buildContextSnapshot`**: TTL 5 minutos por companyId en Redis

### Frontend: Tabla de documentos
- [ ] **Búsqueda**: filtrar por folio, RUT receptor, estado
- [ ] **Sort por columna**: fecha, monto, estado
- [ ] **Paginación**: 25/50/100 por página con controles
- [ ] **Mobile**: responsive con columnas prioritarias en pantallas pequeñas

---

## Sprint 11 — Accesibilidad + Polish General
**Objetivo**: Que cualquier persona pueda usar la app, con o sin experiencia técnica.

### Accesibilidad
- [ ] **`aria-label` en todos los botones de icono**: trash, refresh, download, etc.
- [ ] **`role="dialog"` y focus management** en componente Modal
- [ ] **`aria-describedby`** en todos los campos con error
- [ ] **Contraste WCAG AA**: verificar en toda la paleta ink/paper/oxblood
- [ ] **Navegación con teclado**: tab order lógico en formularios y modales

### Password y autenticación
- [ ] **Indicador de fuerza de contraseña**: barra visual en signup (8 chars, mayúscula, número)
- [ ] **Mensajes de error de login específicos**: distinguir contraseña incorrecta vs usuario no existe

### Navegación mobile
- [ ] **Jerarquía en sidebar colapsado**: mantener grupos visuales
- [ ] **Tipografía mobile**: ajustar headers a `text-xl md:text-2xl lg:text-4xl`

### Tests de este sprint
- [ ] Test axe-core: cero violaciones WCAG AA en páginas principales (login, dashboard, emit, remuneraciones)

---

## Sprint 12 — IA Avanzada: Diferenciación vs Competencia
**Objetivo**: Maximizar la ventaja de ser el único SaaS contable chileno con IA real.

### Mejoras de contexto e inteligencia
- [ ] **Insights proactivos ampliados**: comparación YoY, detección de gastos inusuales, estimación IVA del mes siguiente
- [ ] **Agente de nómina**: "¿Cuánto le va a quedar líquido a Juan si le subo el sueldo a $X?" con herramienta `simulate_payroll`
- [ ] **Detección de inconsistencias**: "Tus ventas subieron 30% pero tu PPM bajó — puede ser observado por SII"
- [ ] **Evaluación A/B modelos**: medir calidad de OCR e Insights con Haiku vs Sonnet para optimizar costos

### Tests de IA
- [ ] `packages/ai-agents/tests/consultor.test.ts` (nuevo): prompt injection bloqueado, tools retornan datos correctos
- [ ] `packages/ai-agents/tests/clasificador.test.ts` (nuevo): clasifica correctamente los 10 tipos de transacción más comunes en Chile
- [ ] `packages/ai-agents/tests/insights.test.ts` (nuevo): genera insights con datos reales de empresa

---

## Resumen ejecutivo

| Sprint | Foco | Semanas | Impacto |
|--------|------|---------|---------|
| 5 | Seguridad + Fix bloqueadores IA | 1-2 | 🔴 No lanzar sin esto |
| 6 | UX no técnicos: formularios y feedback | 3-4 | 🔴 Retención de usuarios |
| 7 | Tests Tier 1: cálculos tributarios | 5-6 | 🔴 Riesgo fiscal para clientes |
| 8 | DTE + Chat IA: flujos principales | 7-8 | 🟠 Diferenciación competitiva |
| 9 | Tests Tier 2 + CI Gate | 9-10 | 🟠 Calidad continua |
| 10 | Performance + tabla documentos | 11-12 | 🟠 Usabilidad con datos reales |
| 11 | Accesibilidad + Polish | 13-14 | 🟡 Incluir a todos los usuarios |
| 12 | IA avanzada: diferenciación | 15-16 | 🟡 Ventaja competitiva a largo plazo |

**Total estimado**: 16 semanas
