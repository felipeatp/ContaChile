# F22 Declaración Anual de Renta Design

## Goal

Implementar un preview interactivo de la Declaración Anual de Renta (F22) chilena que se calcule automáticamente desde los documentos emitidos, compras registradas y F29 acumulados del año. El usuario selecciona el año y el sistema calcula renta líquida, impuesto determinado y saldo a pagar/devolver.

## Context

El proyecto ya tiene:
- Modelo `Document` (ventas emitidas con tipo, folio, montos, fecha)
- Modelo `Purchase` (compras registradas con emisor, montos, fecha, categoría)
- Endpoint `GET /f29` que calcula códigos SII mensuales desde ventas y compras
- Página `/f29` con preview interactivo, cards resumen y tabla de códigos
- Sistema de exportación a PDF vía CSS `@media print`

## Architecture

### No requiere modelo nuevo en Prisma

El F22 se calcula en tiempo real desde datos existentes. No se persiste el cálculo (al igual que el F29).

### Data Flow

```
Usuario selecciona año → GET /f22?year=2025
  ├─ Ingresos:    SUM(Document.totalAmount)  WHERE tipo=33 AND año=2025
  ├─ Costos:      SUM(Purchase.totalAmount)  WHERE tipo=33 AND año=2025
  ├─ Gastos:      SUM(Purchase.totalAmount)  WHERE tipo=46 OR categoría=gasto AND año=2025
  ├─ Renta líquida = Ingresos - Costos - Gastos
  ├─ PPM pagado:  SUM(F29.codigo_91)         WHERE año=2025 (de cada mes)
  ├─ Impuesto:    f(Renta líquida, tabla progresiva)
  └─ Saldo:       Impuesto - PPM
```

### API Endpoint

| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | `/f22` | `?year=2025` | `{ year, lines: [...], summary: {...} }` |

### Frontend

- **Página `/f22`**: Selector de año, cards resumen, tabla detallada, botón Imprimir/PDF
- Reutiliza componentes y estilos de `/f29` (cards, tabla, print CSS)

## F22 Lines (Simplificado)

| Código | Descripción | Fuente |
|--------|-------------|--------|
 525 | Ingresos brutos | SUM(Document.totalAmount WHERE type=33/34) |
 526 | Costos | SUM(Purchase.totalAmount WHERE type=33/34) |
 527 | Gastos operacionales | SUM(Purchase.totalAmount WHERE type=46 OR category≠inventario) |
 528 | Renta líquida | Auto: 525 - 526 - 527 |
 585 | PPM pagado en el año | SUM(F29.code_91 por mes del año) |
 594 | Impuesto determinado | Auto: tabla progresiva sobre Renta líquida |
 595 | Saldo a pagar | Auto: 594 - 585 (si > 0) |
 596 | Saldo a devolver | Auto: 585 - 594 (si > 0) |

## Progressive Tax Table (Chile 2024-2025)

| Renta Líquida Bracket | Rate |
|-----------------------|------|
| Hasta 15 UTA (~$10.8M CLP) | 0% |
| 15 UTA - 30 UTA | 4% |
| 30 UTA - 50 UTA | 8% |
| 50 UTA - 120 UTA | 13.5% |
| Más de 120 UTA | 27% |

UTA = Unidad Tributaria Anual. Configurable via `UTA_VALUE` env var (default: 720_000).

## Calculation Logic

```typescript
function calcularImpuestoRenta(rentaLiquida: number): number {
  const UTA = parseInt(process.env.UTA_VALUE || '720000', 10)
  const brackets = [
    { limit: 15 * UTA, rate: 0 },
    { limit: 30 * UTA, rate: 0.04 },
    { limit: 50 * UTA, rate: 0.08 },
    { limit: 120 * UTA, rate: 0.135 },
    { limit: Infinity, rate: 0.27 },
  ]

  let tax = 0
  let remaining = rentaLiquida

  for (const bracket of brackets) {
    if (remaining <= 0) break
    const taxable = Math.min(remaining, bracket.limit)
    tax += taxable * bracket.rate
    remaining -= taxable
  }

  return Math.floor(tax)
}
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Año sin documentos | Retorna ceros con mensaje informativo |
| Año futuro | 400 Bad Request "El año no puede ser futuro" |
| Año < 2020 | 400 Bad Request "Año no soportado" |
| F29 no calculado para algún mes | PPM = 0 para ese mes (no falla) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `UTA_VALUE` | `720000` | Valor de la UTA en CLP |

## Testing Strategy

1. Emitir facturas (tipo 33) en un año de prueba → verificar línea 525
2. Registrar compras → verificar líneas 526 y 527
3. Calcular F29 de cada mes → verificar PPM acumulado (585)
4. Verificar impuesto con tabla progresiva
5. Verificar saldo a pagar/devolver
6. Testear exportación a PDF con CSS print

## Future Work (out of scope)

- Retenciones de terceros (código 305-307)
- Créditos por donaciones, IVA crédito, etc.
- Ajuste por inflación (IPC)
- Cálculo de PPM del año anterior como crédito
- Webhook al SII para pre-llenado de F22 real
