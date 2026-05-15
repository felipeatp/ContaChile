# Plan de Cuentas (PUC) Design

## Goal

Implementar un Plan de Cuentas (PUC) por empresa en ContaChile, con ~50 cuentas esenciales pre-cargadas al crear una empresa, editables y expandibles por el usuario. El clasificador IA de transacciones bancarias usará el PUC real de la empresa en lugar de cuentas hardcodeadas.

## Context

El proyecto es un monorepo Turborepo con Fastify (API), Next.js (web), Prisma + PostgreSQL. Actualmente no existe ningún modelo de cuentas contables. El agente clasificador de transacciones (`packages/ai-agents/src/agents/clasificador.ts`) usa cuentas hardcodeadas como "4100", "5100", etc.

## Architecture

### Data Model

El modelo `Account` representa una cuenta del PUC. Es propiedad de cada empresa (`companyId`). Las cuentas base vienen pre-cargadas con `isSystem: true`. El usuario puede agregar cuentas personalizadas (`isSystem: false`) y editar/ocultar cualquiera.

```prisma
model Account {
  id          String      @id @default(cuid())
  companyId   String
  code        String      // Ej: "4100", "5100", "1101"
  name        String      // Ej: "Ingresos por ventas"
  type        AccountType // ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO, COSTO
  parentCode  String?     // Para sub-cuentas jerárquicas
  description String?
  isActive    Boolean     @default(true)
  isSystem    Boolean     @default(false) // true = viene del PUC base
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@unique([companyId, code])
  @@index([companyId])
  @@index([type])
}

enum AccountType {
  ACTIVO
  PASIVO
  PATRIMONIO
  INGRESO
  GASTO
  COSTO
}
```

### PUC Base

Definido en código (TypeScript) en `packages/validators/src/puc-base.ts` como un array exportable. Al crear una `Company`, se itera el array y se insertan en la tabla `Account` con `isSystem: true`.

Cuentas incluidas:
- **ACTIVOS** (1101-1115): Caja, Bancos, Clientes, Documentos por cobrar, Inventarios, IVA Crédito Fiscal
- **PASIVOS** (2101-2115): Proveedores, Documentos por pagar, Impuestos por pagar, IVA Débito Fiscal, Remuneraciones por pagar
- **PATRIMONIO** (3101-3110): Capital Social, Reservas, Resultado del ejercicio
- **INGRESOS** (4100-4110): Ventas, Servicios, Arriendo, Diversos, Utilidad del ejercicio
- **COSTOS** (5000-5010): Costo de ventas, Costo de mercaderías
- **GASTOS** (5100-5220): Personal, Honorarios, Arriendo, Servicios básicos, Mantenimiento, Viaje, Marketing, Oficina, Depreciación, Financieros, Legales, Seguros, Patentes, Diversos, Pérdida del ejercicio

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/accounts` | Listar cuentas de la empresa. Query params: `?type=GASTO`, `?active=true` |
| POST | `/accounts` | Crear cuenta personalizada. Body: `{code, name, type, parentCode?, description?}` |
| PATCH | `/accounts/:id` | Editar cuenta. Body: `{name?, description?, isActive?}` |
| DELETE | `/accounts/:id` | Eliminar cuenta. Rechaza si `isSystem: true` |

### Frontend

- **Página `/contabilidad/puc`** (o `/accounts`): Tabla de cuentas con filtros por tipo, búsqueda por código/nombre. Edición inline para cuentas personalizadas. Cuentas del sistema marcadas con icono de candado.
- **Botón "Agregar cuenta"**: Modal/formulario para crear sub-cuentas personalizadas.

### Integration: Clasificador IA

El agente `clasificador.ts` modifica su tool `get_chart_of_accounts` para:
1. Recibir `companyId` como parámetro
2. Consultar `prisma.account.findMany({ where: { companyId, isActive: true } })`
3. Incluir el PUC real en el contexto del modelo al clasificar

## Data Flow

```
Crear Empresa
  └─ seedPucBase(companyId)
       └─ prisma.account.createMany({ PUС_BASE_ACCOUNTS + companyId + isSystem: true })

Usuario gestiona PUC
  └─ GET /accounts → lista del PUC de su empresa
  └─ POST /accounts → agrega cuenta personalizada
  └─ PATCH /accounts/:id → edita nombre/descripción/activo

Clasificador IA
  └─ Recibe transacción bancaria
  └─ Consulta PUC real de la empresa
  └─ Clasifica usando cuentas del PUC como contexto
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Código duplicado en misma empresa | 409 Conflict con mensaje "Ya existe una cuenta con ese código" |
| Intentar eliminar cuenta del sistema | 403 Forbidden "No se pueden eliminar cuentas del PUC base" |
| Cuenta referenciada en asientos | 409 Conflict "Cuenta tiene movimientos, solo se puede desactivar" |
| Empresa sin PUC (legacy) | GET /accounts retorna vacío; se puede re-seed con endpoint manual |

## Environment Variables

No requiere variables nuevas.

## Testing Strategy

1. **Crear empresa** → verificar que se insertan exactamente 50 cuentas en `Account`
2. **GET /accounts** → verificar que retorna solo cuentas de la empresa logueada
3. **POST /accounts** → crear sub-cuenta personalizada, verificar `isSystem: false`
4. **PATCH /accounts/:id** → editar nombre, verificar cambio en DB
5. **DELETE sistema** → verificar 403
6. **Clasificador IA** → verificar que usa cuentas reales del PUC

## Future Work (out of scope)

- Modelo `AccountEntry` para asientos contables (se agregará cuando se implemente el módulo de asientos)
- Jerarquía completa de sub-cuentas (niveles ilimitados)
- Importación de PUC desde Excel
- Reportes: Balance General, Estado de Resultados
