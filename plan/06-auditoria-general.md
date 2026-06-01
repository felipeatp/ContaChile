# Auditoría General ContAI — 2026-06-01

> Auditoría completa realizada por 4 agentes en paralelo cubriendo Frontend/UX, Backend/API, Agentes IA y Tests.
> Objetivo: identificar todos los problemas antes de lanzamiento a producción.

---

## RESUMEN EJECUTIVO

| Área | Score | Estado |
|------|-------|--------|
| Arquitectura general | 8/10 | ✅ Sólida |
| Seguridad | 5/10 | 🔴 Problemas críticos |
| UI/UX (usuarios no técnicos) | 5/10 | 🟠 Necesita trabajo |
| Agentes IA | 6.5/10 | 🟠 Base sólida, gaps críticos |
| Cobertura de tests | 2/10 | 🔴 18.5% — insuficiente |
| Performance | 7/10 | 🟡 Problemas puntuales |

**El producto tiene una base arquitectónica excelente pero necesita hardening en seguridad, validaciones, UX para no técnicos y cobertura de tests antes de lanzar a clientes reales.**

---

## 1. FRONTEND + UI/UX

### CRÍTICO

#### 1.1 `alert()` nativo para errores — Rompe flujo de usuario
- **Archivos**: `components/documents/document-table.tsx:32,66` · `components/layout/header.tsx:215,218`
- **Problema**: Popups nativos bloqueantes. En móvil interrumpen el flujo. Muy disruptivo para usuarios sin experiencia.
- **Fix**: Implementar sistema de toast notifications (Sonner)
- **Esfuerzo**: 6 horas

#### 1.2 Formularios de Remuneraciones sin validación
- **Archivo**: `app/(app)/remuneraciones/trabajadores/page.tsx:190-330`
- **Problemas**: Sin validación de RUT (módulo 11), sin validación de sueldo > 0, sin confirmación al eliminar, state manual en lugar de react-hook-form
- **Fix**: Migrar a zod + react-hook-form
- **Esfuerzo**: 10 horas

#### 1.3 Chat IA sin historial persistente
- **Archivo**: `apps/web/hooks/use-consultor.ts:14`
- **Problema**: `useState` en cliente — pierde todo al recargar. Sin timestamps reales. UI confusa sobre quién responde.
- **Fix**: Persistencia a DB + UI mejorada
- **Esfuerzo**: 15 horas

#### 1.4 Emisión DTE: flujo con problemas críticos para no técnicos
- **Archivo**: `components/emit/emit-form.tsx`
- **Problemas**: Sin preview antes de emitir, sin validación visual de RUT en tiempo real, "Bridge · Acepta" sin explicación, sin confirmación de 2 pasos
- **Fix**: Modal de preview, tooltips, confirmación
- **Esfuerzo**: 12 horas

### ALTO

#### 1.5 Accesibilidad incompleta
- Solo 50 atributos `aria-` en 45 componentes (~10% coverage)
- Sin `aria-label` en botones de icono, sin `role="dialog"` en modales, sin focus management
- **Esfuerzo**: 10 horas

#### 1.6 Tabla de documentos sin features básicas
- Sin búsqueda, sin filtro, sin sort, sin paginación
- Con 1000+ docs renderiza todo el DOM
- **Esfuerzo**: 10 horas

#### 1.7 Liquidaciones: UX confuso
- Botón "Generar mes" sin confirmación (riesgo de duplicados)
- Selects nativos rompiendo design system
- Sin historial de períodos anteriores
- **Esfuerzo**: 6-8 horas

#### 1.8 F29/F22: códigos SII sin explicación
- Tabla muestra "502", "595" sin tooltips
- Inaceptable para usuarios sin experiencia contable
- **Esfuerzo**: 5-7 horas

### MEDIO

#### 1.9 Duplicación de patrones de formulario
- 2 patrones (react-hook-form vs state manual) mezclados en diferentes páginas
- **Esfuerzo**: 6-8 horas

#### 1.10 Sidebar mobile sin jerarquía
- Etiquetas de sección desaparecen en móvil colapsado
- **Esfuerzo**: 3-4 horas

#### 1.11 Sin indicador de fuerza de contraseña
- Login y signup sin feedback visual
- **Esfuerzo**: 3-4 horas

#### 1.12 Tipografía en mobile muy grande
- Headers 48px+ en pantallas 320px
- **Esfuerzo**: 3-4 horas

### BAJO

#### 1.13 Estados de loading inconsistentes
- 3 patrones diferentes (spinner, skeleton, nada)
- **Esfuerzo**: 4-5 horas

#### 1.14 Botones de cancelar inconsistentes
- "Cancelar" vs "Cerrar" vs sin botón
- **Esfuerzo**: 1-2 horas

---

## 2. BACKEND + API

### CRÍTICO

#### 2.1 🔴 Certificado SII: fallback a plaintext
- **Archivo**: `apps/api/src/routes/dte/emit.ts:72` · `packages/db/prisma/schema.prisma:392`
- **Problema**: Fallback a `company.certPassword` (texto plano) si `certPasswordEncrypted` no existe. Equivale a exponer identidad fiscal en backups/logs.
- **Fix**: Eliminar fallback, forzar re-upload con cifrado
- **Esfuerzo**: 4-6 horas

#### 2.2 🔴 Sin RBAC en rutas críticas
- **Archivo**: `apps/api/src/plugins/tenant.ts:122-136`
- **Problema**: Un miembro con rol "viewer" puede cambiar certificado, crear API keys, modificar webhooks. No hay `requireRole('owner'|'admin')`.
- **Fix**: Middleware de roles en rutas críticas
- **Esfuerzo**: 5-6 horas

#### 2.3 🔴 API Keys: sin validación de scopes
- **Archivo**: `apps/api/src/routes/api-keys.ts:14-37`
- **Problema**: Usuario puede crear key con scope `*` (acceso total). Sin auditoría de quién creó qué key.
- **Fix**: Whitelist de scopes + registro de usuario
- **Esfuerzo**: 3-4 horas

### ALTO

#### 2.4 Certificado no validado al subir
- **Archivo**: `apps/api/src/routes/company.ts:72-107`
- **Problema**: Acepta cualquier base64 > 100 bytes. No valida que sea .pfx válido ni que el RUT coincida.
- **Fix**: Validar con `extractPrivateKeyFromPfx()` + verificar RUT
- **Esfuerzo**: 3 horas

#### 2.5 N+1 en cálculo F22
- **Archivo**: `apps/api/src/routes/f22.ts:79-94`
- **Problema**: 12 queries separadas (una por mes) en lugar de 1 con `groupBy`
- **Fix**: Refactorizar con agregación
- **Esfuerzo**: 2 horas

#### 2.6 Sin paginación en endpoints de listado
- **Archivos**: `inventory/products`, `inventory/movements`, `quotes`, `accounting/journal`
- **Problema**: Retorna TODOS los registros. 50K productos = explosión de memoria
- **Fix**: Paginación limit/offset en todos los GET de listado
- **Esfuerzo**: 6-8 horas

#### 2.7 Errores sin loggear en workers
- **Archivos**: `workers/alerts.ts:71` · `workers/dte-polling.ts:145-162`
- **Problema**: `catch { stats.errors++ }` — imposible debuggear problemas de entregas
- **Fix**: `fastify.log.error()` en todos los catch
- **Esfuerzo**: 2-3 horas

#### 2.8 Rate limiting incompleto
- Sin rate limit en: POST `/api-keys`, POST `/company/certificate`, POST `/webhooks`
- **Esfuerzo**: 2 horas

### MEDIO

#### 2.9 Índices de BD faltantes
- `BankMovement`: falta `@@index([companyId, status])`
- `Document`: falta `@@index([companyId, status, emittedAt])`
- `JournalLine`: falta `@@index([accountId, journalEntryId])`
- **Esfuerzo**: 1-2 horas

#### 2.10 Validación de fechas en queries
- `new Date(query.from)` sin validación — falla silenciosamente
- **Fix**: `z.coerce.date()` en todas las queries de API
- **Esfuerzo**: 4 horas

#### 2.11 Sin CSRF protection
- `@fastify/csrf-protection` no implementado
- **Esfuerzo**: 2-3 horas

#### 2.12 Sin auditoría de cambios críticos
- Schema tiene `AuditLog` pero solo para documentos
- Cambios de certificado, API keys, webhooks sin registro
- **Esfuerzo**: 6-8 horas

---

## 3. AGENTES IA

### CRÍTICO

#### 3.1 🔴 AgentEvent format mismatch — F22 NUNCA funciona
- **Archivos**: `packages/ai-agents/src/base-agent.ts:35-37` · `packages/ai-agents/src/agents/f22-assistant.ts:162-170`
- **Problema**: F22 emite `{ type: 'text_delta' }` pero frontend espera `{ kind: 'text' }`. El agente F22 **nunca funciona en producción**.
- **Fix**: Unificar en `AgentEvent` union type en base-agent.ts
- **Esfuerzo**: 2 horas

#### 3.2 🔴 Sin persistencia de conversaciones
- **Archivo**: `apps/web/hooks/use-consultor.ts:14`
- **Problema**: Historial solo en `useState` — pierde todo al recargar. Sin modelo `AgentConversation` en DB. Imposible auditar consultas tributarias.
- **Fix**: Modelo Prisma + endpoint GET historial + UI
- **Esfuerzo**: 8 horas

#### 3.3 Prompts demasiado técnicos para usuarios chilenos
- **Archivos**: `packages/ai-agents/src/agents/consultor.ts:12-53`
- **Problema**: "Documentos Tributarios Electrónicos" en lugar de "Facturas digitales". Sin ejemplos con montos concretos. Sin urgencia (días faltantes). Sin "por qué" de cada obligación.
- **Fix**: Reescribir prompts con lenguaje de dueño de PYME
- **Esfuerzo**: 4 horas

### ALTO

#### 3.4 Contexto insuficiente (sin comparación histórica)
- **Archivo**: `packages/ai-agents/src/context.ts:37-101`
- **Problema**: Solo obtiene mes actual. Sin comparación año vs año, sin alertas del usuario, sin ratios de rentabilidad.
- **Fix**: Ampliar `buildContextSnapshot` con histórico
- **Esfuerzo**: 8 horas

#### 3.5 Selección de modelos no optimizada
- OCR y Insights usan Sonnet cuando Haiku sería suficiente (~40% ahorro de costo)
- **Esfuerzo**: 1 día de evaluación A/B

#### 3.6 Sin tests para agentes críticos
- Consultor: 0 tests · Clasificador: 0 tests · Insights: 0 tests
- **Esfuerzo**: 2 días

### MEDIO

#### 3.7 Defensa contra prompt injection débil en OCR e Insights
- OCR no envuelve input en tags XML
- Insights usa input directo sin envolver
- **Esfuerzo**: 2 horas

#### 3.8 `buildContextSnapshot` no cacheado
- Se regenera en cada request: 50-200ms de latencia innecesaria por request
- **Esfuerzo**: 4 horas

### Gaps de IA vs competencia
Nubox y Defontana **no tienen IA real**. Oportunidades de diferenciación:
- Análisis predictivo: "¿Cuándo me audita el SII?"
- Sugerencias de optimización tributaria (timing de PPM)
- Agente de nómina (análisis de liquidaciones en lenguaje simple)
- Reporte de inconsistencias detectadas automáticamente

---

## 4. TESTS + COBERTURA

### Estado actual: 18.5% de cobertura global

| Área | Cobertura | Riesgo |
|------|-----------|--------|
| packages/dte | 72% | Bajo |
| packages/validators | 21% | CRÍTICO |
| packages/ai-agents | 22% | Alto |
| apps/api/routes | 39% | CRÍTICO |
| apps/api/lib | 5% | CRÍTICO |
| apps/web/e2e | 40% | Medio |
| apps/web/components | <1% | CRÍTICO |

### 20 tests más críticos faltantes

**Tier 1 — Cálculos que afectan dinero (riesgo fiscal):**
1. `packages/validators/tests/payroll.test.ts` — cálculo liquidación (AFP, ISAPRE, cesantía, impuesto único, 8 brackets)
2. `packages/validators/tests/tax.test.ts` — IVA con casos edge (negativo, cero, extremos, millones)
3. `apps/api/tests/f22-calculations.test.ts` — 8 brackets impuesto único, renta negativa
4. `apps/api/tests/f29-calculations.test.ts` — IVA débito vs crédito, remanente
5. `packages/validators/tests/rut.test.ts` — todos los dígitos verificadores (0-9, K), RUT máximo
6. `packages/dte/tests/signer.test.ts` — detección de tampering, certificado expirado
7. `apps/api/tests/security/multi-tenancy.test.ts` — usuario A no ve datos empresa B

**Tier 2 — Flujos críticos:**
8. `packages/validators/tests/document.test.ts` — receptor sin RUT, ítems negativos, totales incorrectos
9. `apps/api/tests/dte/folio-concurrency.test.ts` — 10 requests simultáneos no generan folio duplicado
10. `apps/api/tests/lib/accounting-entries.test.ts` — DTE genera asiento contable correcto
11. `apps/api/tests/lib/bank-service.test.ts` — diferencia de 1 CLP detectada
12. `apps/api/tests/lib/inventory-service.test.ts` — stock no puede ser negativo
13. `apps/api/tests/routes/payroll.test.ts` — generación mensual, validación mes/año
14. `apps/api/tests/routes/accounting/reports.test.ts` — balance cuadra, ingresos - gastos = utilidad

**Tier 3 — Integraciones y seguridad:**
15. `apps/api/tests/routes/webhooks.test.ts` — rechazo SII actualiza estado y notifica
16. `apps/api/tests/queues/dte.test.ts` — reintentos con backoff, máximo 3 intentos
17. `apps/api/tests/auth/permissions.test.ts` — roles y permisos por operación
18. `apps/api/tests/lib/payroll-service.test.ts` — cálculo completo con trabajadores reales
19. `apps/api/tests/lib/financial-statements.test.ts` — balance general cuadra
20. `apps/api/tests/ocr.test.ts` — extracción de RUT, montos, folio de documentos

### Problemas de calidad en tests existentes
- **Mocks excesivos**: `f22.test.ts` mockea toda la DB → falsos positivos
- **Casos edge faltantes**: `calcularIVA` solo prueba 1 valor
- **Sin tests de integración**: ningún flujo end-to-end real en API
- **Sin CI gate**: no hay GitHub Actions bloqueando merge con cobertura baja

---

## 5. COMPARACIÓN COMPETITIVA

### vs. Nubox

| Característica | ContAI | Nubox |
|----------------|--------|-------|
| Consultor IA con tool use | ✅ | ❌ No tiene |
| Preview DTE antes de emitir | ❌ Falta | ✅ Tiene |
| Validación de formularios | ❌ Débil | ✅ Robusta |
| Paginación y búsqueda en tablas | ❌ Falta | ✅ Tiene |
| Tooltips contextuales | ❌ Escasos | ✅ Buenos |

### vs. Defontana

| Característica | ContAI | Defontana |
|----------------|--------|-----------|
| IA real integrada | ✅ | ❌ No tiene |
| Interfaz visual moderna | ✅ | ❌ Pesada/antigua |
| Historial de chat persistente | ❌ Falta | N/A |
| Ayuda contextual en línea | ❌ Escasa | ✅ Buena |
| Búsqueda en documentos | ❌ Falta | ✅ Tiene |

### Conclusión
ContAI tiene el diferenciador único más potente del mercado chileno (IA real). Pero necesita cerrar las brechas de usabilidad básica para que ese diferenciador sea visible. Un contador no valorará el chat IA si no puede encontrar sus documentos o si un formulario no valida el RUT.

---

## TOTALES DE ESFUERZO

| Categoría | Horas estimadas |
|-----------|----------------|
| Seguridad crítica (backend) | 25-35h |
| Fix bloqueadores IA | 15-20h |
| UX no técnicos (frontend) | 45-55h |
| Tests críticos | 60-80h |
| Performance y hardening | 20-25h |
| Mejoras IA avanzadas | 40-60h |
| **Total** | **205-275 horas** |
