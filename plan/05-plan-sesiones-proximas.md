# Plan de Sesiones — Módulos Pendientes ContaChile

> Documento generado el 2026-05-15 tras análisis competitivo contra Nubox, Defontana, Bsale y Buk.
> Cubre todo lo necesario para pasar de "facturador con IA" a "suite contable completa competitiva".

---

## Estado actual (lo que ya está implementado)

- ✅ Motor DTE: emisión de facturas (33), boletas (39), notas crédito/débito (56/61), envío DTE
- ✅ Libro de ventas y libro de compras
- ✅ F29 (cálculo IVA débito/crédito, preview, PDF)
- ✅ Multi-tenant: auth por companyId, schema-per-tenant
- ✅ Receptores (clientes/proveedores)
- ✅ Plan de cuentas (accounts route — base)
- ✅ Agente clasificador IA de transacciones bancarias
- ✅ Consultor tributario IA (streaming + tool use)
- ✅ Seguridad API: CORS, Helmet, rate limit, prompt injection, audit log
- ✅ SEO: metadata, robots, sitemap

---

## Prioridad de módulos

```
BLOQUEA VENTAS HOY          DIFERENCIADOR           ESCALA
─────────────────────       ─────────────────       ──────────────────
1. Contabilidad general  →  5. Conciliación banc.  → 8. F22 con IA
2. Remuneraciones base   →  6. Cotizaciones/OC     → 9. OCR IA
3. Alertas vencimiento   →  7. Inventario básico   → 10. App móvil
4. Boletas honorarios                               → 11. API pública
```

---

## MÓDULO 1 — Contabilidad General Completa
**Prioridad: CRÍTICA | Estimado: 2-3 sesiones**

Sin esto no somos un software contable — somos un facturador con extras.
Cualquier contador lo rechaza en la primera demo porque sin balance no puede cerrar el año.

### Sesión 1A — Libro Diario y Mayor

**Objetivo:** Registrar asientos manuales y automáticos, consultar por cuenta.

**Pasos:**

1. **Schema Prisma — tabla `journal_entries`**
   ```prisma
   model JournalEntry {
     id          String   @id @default(cuid())
     date        DateTime
     description String
     reference   String?  // número DTE, factura, etc.
     source      String   // 'manual' | 'dte' | 'purchase' | 'ai'
     createdAt   DateTime @default(now())
     lines       JournalLine[]
   }

   model JournalLine {
     id             String       @id @default(cuid())
     journalEntryId String
     accountId      String       // FK → accounts
     debit          Decimal      @default(0) @db.Decimal(18,0)
     credit         Decimal      @default(0) @db.Decimal(18,0)
     journalEntry   JournalEntry @relation(...)
     account        Account      @relation(...)
   }
   ```
   - Migrar en schema del tenant (tenant_{company_id})
   - Validar que `SUM(debit) = SUM(credit)` antes de guardar (trigger o validación Zod)

2. **API routes — `apps/api/src/routes/accounting/`**
   - `POST /accounting/journal` — crear asiento manual
   - `GET /accounting/journal` — listar asientos (paginado, filtro por fecha/cuenta)
   - `GET /accounting/journal/:id` — detalle
   - `GET /accounting/ledger/:accountId` — movimientos de una cuenta (libro mayor)

3. **Asientos automáticos desde DTE**
   - En `routes/dte/emit.ts`: al emitir una factura, crear asiento automático:
     - Débito: Clientes (1130) por total con IVA
     - Crédito: Ventas (4110) por neto
     - Crédito: IVA Débito Fiscal (2110) por IVA
   - En `routes/purchases`: al registrar compra, crear asiento:
     - Débito: cuenta de gasto correspondiente por neto
     - Débito: IVA Crédito Fiscal (1195) por IVA
     - Crédito: Proveedores (2130) por total

4. **UI — `apps/web/app/(dashboard)/contabilidad/`**
   - Página `/contabilidad/libro-diario`: tabla de asientos con filtros
   - Formulario de asiento manual: fecha, descripción, líneas debe/haber, validación cuadratura
   - Página `/contabilidad/mayor`: selector de cuenta → movimientos del período

### Sesión 1B — Estados Financieros

**Objetivo:** Balance de comprobación, estado de resultados, balance general.

**Pasos:**

1. **Lógica de agrupación del PUC**
   - Los `accounts` ya tienen código. Agrupar por clase:
     - Clase 1 (Activo), Clase 2 (Pasivo), Clase 3 (Patrimonio)
     - Clase 4 (Ingresos), Clase 5 (Gastos)
   - Función `getTrialBalance(companyId, month, year)` → saldos por cuenta

2. **API routes — `apps/api/src/routes/accounting/reports.ts`**
   - `GET /accounting/reports/trial-balance?month=&year=` — balance de comprobación
   - `GET /accounting/reports/income-statement?from=&to=` — estado de resultados (PyG)
   - `GET /accounting/reports/balance-sheet?date=` — balance general
   - Cada endpoint retorna estructura jerárquica lista para renderizar

3. **UI — `apps/web/app/(dashboard)/contabilidad/reportes/`**
   - Componente `TrialBalance` — tabla con columnas: cuenta / saldo deudor / saldo acreedor
   - Componente `IncomeStatement` — ingresos - gastos = utilidad del período
   - Componente `BalanceSheet` — activo = pasivo + patrimonio
   - Botón "Exportar PDF" en cada reporte
   - Selector de período (mes/año o rango libre)

---

## MÓDULO 2 — Remuneraciones Base
**Prioridad: CRÍTICA | Estimado: 2-3 sesiones**

Cualquier pyme con empleados necesita esto. Sin remuneraciones, el cliente usa Buk en paralelo y eventualmente migra todo.

### Sesión 2A — Ficha de Trabajadores y Contratos

**Pasos:**

1. **Schema Prisma**
   ```prisma
   model Employee {
     id            String   @id @default(cuid())
     rut           String
     name          String
     email         String?
     startDate     DateTime
     endDate       DateTime?
     position      String
     baseSalary    Decimal  @db.Decimal(18,0)
     contractType  String   // 'indefinido' | 'plazo_fijo' | 'honorarios'
     workHours     Int      @default(45)  // horas semanales
     afp           String   // 'capital' | 'cuprum' | 'habitat' | 'modelo' | 'planvital' | 'provida' | 'uno'
     healthPlan    String   // 'fonasa' | rut_isapre
     healthAmount  Decimal? // si es isapre: monto pactado
     payrolls      Payroll[]
   }
   ```

2. **API routes — `apps/api/src/routes/employees/`**
   - `GET/POST /employees` — listar y crear trabajadores
   - `GET/PUT/DELETE /employees/:id` — detalle y edición
   - Validar RUT con algoritmo módulo 11 (ya existe en `packages/validators`)

3. **UI — `apps/web/app/(dashboard)/remuneraciones/trabajadores/`**
   - Lista de trabajadores activos con sueldo base, cargo, AFP
   - Formulario de alta: datos personales, contrato, previsión

### Sesión 2B — Liquidaciones de Sueldo

**Pasos:**

1. **Lógica de cálculo en `packages/remuneraciones/src/liquidacion.ts`** (nuevo package)
   ```typescript
   // Tasas vigentes 2026
   const AFP_RATES = {
     capital: 0.1144, cuprum: 0.1144, habitat: 0.1127,
     modelo: 0.1058, planvital: 0.1154, provida: 0.1145, uno: 0.1069
   }
   const SALUD_EMPLEADO = 0.07          // 7% fijo
   const SEGURO_CESANTIA_EMPLEADO = 0.006  // 0.6%
   const SEGURO_CESANTIA_EMPLEADOR = 0.024  // 2.4%

   export function calcularLiquidacion(employee: Employee, period: {month: number, year: number}) {
     const bruto = employee.baseSalary  // + horas extras + bonos si aplica
     const afp = Math.round(bruto * AFP_RATES[employee.afp])
     const salud = Math.round(bruto * SALUD_EMPLEADO)
     const cesantia = Math.round(bruto * SEGURO_CESANTIA_EMPLEADO)
     const baseImponible = bruto - afp - salud - cesantia
     const impuesto = calcularImpuestoUnico(baseImponible)  // tabla progresiva mensual
     const liquido = bruto - afp - salud - cesantia - impuesto
     return { bruto, afp, salud, cesantia, baseImponible, impuesto, liquido }
   }
   ```
   - Tabla de impuesto único mensual 2026 (tramos actualizados según SII)
   - Función para calcular horas extras (50% recargo)

2. **API routes — `apps/api/src/routes/payroll/`**
   - `POST /payroll/generate` — genera liquidaciones del mes para todos los trabajadores
   - `GET /payroll/:month/:year` — lista liquidaciones del período
   - `GET /payroll/:id/pdf` — genera PDF de liquidación individual

3. **PDF de liquidación**
   - Usar el mismo motor PDF existente (ver `routes/dte/pdf`)
   - Formato legal chileno: encabezado empresa, datos trabajador, haberes, descuentos, líquido

4. **UI — `apps/web/app/(dashboard)/remuneraciones/liquidaciones/`**
   - Botón "Generar liquidaciones" para el mes actual
   - Lista de liquidaciones con estado (borrador / aprobado / pagado)
   - Vista individual con haberes / descuentos / líquido
   - Descarga PDF

### Sesión 2C — Exportación PreviRed y DDJJ

**Pasos:**

1. **Archivo PreviRed**
   - Formato texto fijo (`previ_AAAAMM_RUT.txt`) según especificación PreviRed
   - Incluye: AFP, salud, cesantía empleado y empleador por cada trabajador
   - `GET /payroll/previRed/:month/:year` → descarga el archivo

2. **DDJJ 1887 (honorarios)**
   - Para trabajadores con contrato de honorarios
   - Suma anual de honorarios pagados + retención 13.75%
   - Exportación en formato SII para marzo de cada año

---

## MÓDULO 3 — Alertas de Vencimiento
**Prioridad: CRÍTICA | Estimado: 1 sesión**

Si el cliente paga el F29 atrasado porque ContaChile no avisó, culpa al software.

### Sesión 3A — Sistema de Alertas

**Pasos:**

1. **Calendario de vencimientos chilenos (constante)**
   ```typescript
   // packages/validators/src/vencimientos.ts
   export const VENCIMIENTOS_MENSUALES = [
     { dia: 10, codigo: 'COTIZACIONES', nombre: 'Pago cotizaciones previsionales (PreviRed)' },
     { dia: 12, codigo: 'RETENCION_HONORARIOS', nombre: 'Retención honorarios (13.75%)' },
     { dia: 20, codigo: 'F29', nombre: 'Declaración y pago F29 (IVA)' },
   ]
   // Si cae en fin de semana → siguiente lunes hábil
   ```

2. **Worker de alertas — `apps/api/src/workers/alertas.ts`**
   - Cron diario a las 08:00 (BullMQ)
   - Para cada empresa activa: calcular vencimientos del mes en curso
   - Enviar email de alerta 5 días antes y 1 día antes de cada vencimiento
   - Registro en DB para evitar duplicados

3. **Email de alerta (Resend)**
   - Template: "Recordatorio: tu F29 de [mes] vence el [fecha] — faltan X días"
   - Link directo al módulo correspondiente en ContaChile
   - Opción de unsubscribe por tipo de alerta

4. **UI — notificaciones in-app**
   - Banner en dashboard: "Tienes 2 vencimientos esta semana"
   - Centro de notificaciones en sidebar (campana)
   - Configuración de alertas por empresa: qué notificar, con cuántos días de anticipación

---

## MÓDULO 4 — Boletas de Honorarios
**Prioridad: CRÍTICA | Estimado: 1 sesión**

Los profesionales independientes (segunda categoría) son un segmento enorme. El SII las da gratis, pero integrarlas en el dashboard es el diferenciador de onboarding.

### Sesión 4A — Honorarios

**Pasos:**

1. **Tipos DTE a agregar en motor existente**
   - El SII gestiona boletas de honorarios por su propia plataforma (no son DTE XML)
   - Integrar con API BHE (Boleta de Honorarios Electrónica) del SII
   - `packages/sii-client/src/bhe.ts`: endpoints para emitir y consultar BHE

2. **Schema y routes**
   - `GET /honorarios` — boletas emitidas del período
   - Cálculo automático de retención 13.75% sobre monto bruto
   - Integración en libro de compras cuando se recibe BHE de proveedor

3. **DDJJ 1887** — ver Módulo 2C

---

## MÓDULO 5 — Conciliación Bancaria (Fintoc + IA)
**Prioridad: ALTA | Estimado: 2 sesiones**

Este módulo convierte la contabilidad manual en automatización real. Con el clasificador IA ya implementado, la mitad del trabajo está hecha.

### Sesión 5A — Integración Fintoc

**Pasos:**

1. **`packages/fintoc-client/src/`** (nuevo package)
   - OAuth flow con Fintoc (widget embed en el frontend)
   - `GET /movements?from=&to=` → movimientos bancarios del período
   - Guardar `access_token` cifrado por empresa en DB
   - Tabla `bank_movements` en schema tenant

2. **Polling automático**
   - Worker BullMQ: sincronizar movimientos cada 6 horas
   - Marcar nuevos movimientos como "pendiente de clasificar"

### Sesión 5B — Conciliación con Clasificador IA

**Pasos:**

1. **Flujo de conciliación**
   - Movimiento bancario pendiente → clasificador IA sugiere cuenta + asiento
   - UI: lista de movimientos sin clasificar, con sugerencia IA y confianza
   - Acción del usuario: aprobar / corregir / rechazar
   - Al aprobar: crear asiento en libro diario automáticamente

2. **Matching automático**
   - Si el movimiento coincide exactamente con un DTE emitido (monto + RUT): conciliar automáticamente sin revisión humana
   - Reporte de conciliación: movimientos conciliados vs. pendientes

---

## MÓDULO 6 — Cotizaciones y Órdenes de Compra
**Prioridad: ALTA | Estimado: 1-2 sesiones**

Flujo de ventas completo. Bsale es fuerte aquí. Es la puerta de entrada natural antes de emitir factura.

### Sesión 6A — Cotizaciones

**Pasos:**

1. **Schema: `quotes` y `quote_items`**

2. **API routes — `apps/api/src/routes/quotes.ts`**
   - CRUD completo de cotizaciones
   - Estados: borrador → enviado → aceptado → rechazado → facturado
   - `POST /quotes/:id/to-invoice` → convierte cotización en factura (tipo 33) con 1 clic

3. **UI — `apps/web/app/(dashboard)/ventas/cotizaciones/`**
   - Formulario igual al de emisión DTE pero con estado "cotización"
   - PDF de cotización descargable (con branding de la empresa)
   - Link público para que el cliente vea y acepte online

---

## MÓDULO 7 — Inventario Básico
**Prioridad: ALTA | Estimado: 1-2 sesiones**

Muchas pymes necesitan stock. Sin inventario, perdemos a todo retail y comercio.

### Sesión 7A — Control de Stock

**Pasos:**

1. **Schema: `products` e `inventory_movements`**
   ```prisma
   model Product {
     id          String  @id @default(cuid())
     code        String
     name        String
     description String?
     unit        String  // 'unidad' | 'kg' | 'litro' | etc.
     salePrice   Decimal @db.Decimal(18,0)
     costPrice   Decimal @db.Decimal(18,0)
     stock       Decimal @default(0) @db.Decimal(18,4)
     minStock    Decimal @default(0)  // alerta de stock bajo
     affectedIVA Boolean @default(true)
   }
   ```

2. **Movimientos automáticos**
   - Al emitir DTE de venta: descontar stock
   - Al registrar compra: agregar stock
   - Valorización FIFO o costo promedio

3. **API routes — `apps/api/src/routes/inventory.ts`**

4. **UI — `apps/web/app/(dashboard)/inventario/`**
   - Catálogo de productos con stock actual
   - Alertas de stock mínimo
   - Kardex (historial de movimientos por producto)

---

## MÓDULO 8 — F22 con IA
**Prioridad: ALTA (retención anual) | Estimado: 2 sesiones**

La gran declaración de abril. Sin F22, el cliente necesita ir a otro proveedor una vez al año. El diferenciador es hacerlo con IA que explica cada código.

### Sesión 8A — Cálculo F22

**Pasos:**

1. **Recopilar datos del año tributario**
   - PPM acumulados desde los F29 del año
   - Gastos rechazados (compras no aceptadas)
   - Retenciones de honorarios recibidos
   - Utilidades / pérdidas del ejercicio (desde estados financieros)

2. **Lógica de cálculo en `packages/remuneraciones/src/f22.ts`**
   - Primera categoría: 27% sobre utilidades (empresas)
   - Segunda categoría: tabla de impuesto global complementario (personas)

3. **Agente IA F22 — `packages/ai-agents/src/agents/f22-assistant.ts`**
   - Herramientas: leer PPM, gastos, retenciones, resultados del año
   - Output: borrador F22 + explicación en lenguaje simple de cada código
   - Detectar inconsistencias: "Tu PPM acumulado es mayor al impuesto — tendrías devolución de $X"

---

## MÓDULO 9 — OCR IA de Documentos
**Prioridad: MEDIA | Estimado: 1 sesión**

Captura de gastos en terreno. El agente ya está especificado en `agentes/00-arquitectura-ia.md`.

### Sesión 9A — OCR con Claude Vision

**Pasos:**

1. **Endpoint de upload — `apps/api/src/routes/ocr.ts`**
   - `POST /ocr/document` — recibe imagen (multipart/form-data)
   - Almacena en Cloudflare R2
   - Pasa base64 al agente OCR (Claude Sonnet con visión)

2. **Agente OCR — `packages/ai-agents/src/agents/ocr.ts`**
   - Extrae: tipo documento, número, fecha, RUT emisor, neto, IVA, total, descripción
   - Crea compra con estado "por aprobar" en DB

3. **UI**
   - Botón "Capturar comprobante" en módulo de compras
   - Preview de los datos extraídos antes de aprobar
   - Corrección manual de campos si hay error de extracción

---

## MÓDULO 10 — API Pública Documentada
**Prioridad: MEDIA | Estimado: 1 sesión**

Para contadores que quieren automatizar y para startups como Sofía. Genera el canal B2B más poderoso a largo plazo.

### Sesión 10A — API REST Pública

**Pasos:**

1. **Autenticación API Key**
   - Tabla `api_keys` en DB: hash de la key, nombre, permisos, fecha expiración
   - Middleware Fastify que acepta `Authorization: Bearer <api_key>` como alternativa a JWT

2. **Documentación OpenAPI / Swagger**
   - Fastify tiene plugin `@fastify/swagger` — generar spec automáticamente desde schemas Zod existentes
   - Publicar en `/api/docs` (solo en modo desarrollo o con API key especial)

3. **Webhooks para eventos**
   - Tabla `webhooks` por empresa: URL destino + eventos suscritos
   - Worker que dispara POST al URL cuando ocurre evento: DTE emitido, pago recibido, F29 listo, etc.
   - Firma HMAC en header `X-ContaChile-Signature` para verificar autenticidad

---

## MÓDULO 11 — App Móvil (React Native)
**Prioridad: BAJA-MEDIA | Estimado: 3-4 sesiones**

Para emprendedores como Catalina. Fotografiar una boleta y que el OCR la clasifique.
No es bloqueante para contratar pero es muy valorado en NPS.

### Pasos generales:

1. **`apps/mobile/` con Expo (React Native)**
   - Reutilizar todos los endpoints de la API existente
   - Autenticación con los mismos tokens JWT de Clerk

2. **Features mínimas del MVP móvil**
   - Ver resumen del mes (ventas, gastos, IVA a pagar)
   - Emitir boleta electrónica rápida (flujo de 3 pasos)
   - Capturar gasto con cámara (OCR IA)
   - Recibir notificaciones push de vencimientos

---

## Resumen de sesiones y orden sugerido

| # | Módulo | Sesiones | Prioridad | Impacto |
|---|--------|----------|-----------|---------|
| 1A | Libro diario y mayor | 1 | 🔴 Crítica | Sin esto no somos contables |
| 1B | Estados financieros | 1 | 🔴 Crítica | Balance y resultados |
| 2A | Ficha trabajadores | 1 | 🔴 Crítica | Base de RRHH |
| 2B | Liquidaciones + PDF | 1 | 🔴 Crítica | El core de remuneraciones |
| 2C | PreviRed + DDJJ 1887 | 1 | 🔴 Crítica | Obligatorio para producción |
| 3A | Alertas vencimiento | 1 | 🔴 Crítica | Retención de clientes |
| 4A | Boletas honorarios | 1 | 🔴 Crítica | Segmento segunda categoría |
| 5A | Fintoc integración | 1 | 🟡 Alta | Base de conciliación |
| 5B | Conciliación + IA | 1 | 🟡 Alta | Automatización real |
| 6A | Cotizaciones y OC | 1 | 🟡 Alta | Flujo ventas completo |
| 7A | Inventario stock | 1-2 | 🟡 Alta | Retail y comercio |
| 8A | F22 con IA | 2 | 🟡 Alta | Retención anual |
| 9A | OCR IA | 1 | 🟢 Media | Captura gastos terreno |
| 10A | API pública | 1 | 🟢 Media | Canal B2B |
| 11 | App móvil | 3-4 | 🟢 Baja-Media | NPS, no bloqueante |

**Total estimado para paridad competitiva (módulos 1-4):** ~8-9 sesiones
**Total para ventaja competitiva clara (módulos 1-8):** ~14-16 sesiones

---

## Notas técnicas transversales

### Patrón para nuevos módulos
Siempre seguir este orden dentro de cada sesión:
1. Schema Prisma → migración en tenant schema
2. Zod validators en `packages/validators/`
3. Routes en `apps/api/src/routes/`
4. Actualizar `apps/api/src/index.ts` con el nuevo registro
5. UI en `apps/web/app/(dashboard)/`
6. Tests unitarios en el package correspondiente

### Tasas legales a mantener actualizadas
- AFP: varía por AFP (ver CMF/SP cada año)
- Salud obligatoria empleado: 7% fijo
- Seguro cesantía: 0.6% empleado, 2.4% empleador (contrato indefinido)
- Impuesto único mensual: tabla progresiva SII (actualizar cada enero)
- Tasa PPM: varía por actividad y año (ver tabla SII F29 código 563)
- IVA: 19% (no ha cambiado desde 1988)

### Integraciones externas pendientes de credenciales
- Fintoc: solicitar API key en dashboard.fintoc.com
- SII BHE (Boletas de Honorarios Electrónicas): mismas credenciales que DTE
- PreviRed: archivo de texto, no requiere API key
- Stripe + WebPay: para billing interno de ContaChile (planes Pro/Agency)
