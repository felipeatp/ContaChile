# Diseño: Integración Dashboard + Flujo Emisión DTE

## Contexto
El motor DTE está completo en backend. El frontend web tiene login/dashboard con Clerk pero:
- Dashboard no muestra datos reales del API (auth/proxy roto)
- Formulario /emit es básico: modo bridge no funciona, sin cálculo de totales

## Tarea 1: Dashboard con datos reales

### Problema
`api-server.ts` hace fetch directo a `localhost:3001` desde Server Components. Las Server Components no tienen acceso al Bearer token de Clerk del navegador; el backend requiere `verifyToken`. Resultado: `ECONNREFUSED` o `401`.

### Solución
Usar rutas proxy `/api/*` de Next.js. El navegador envía cookies de sesión Clerk al proxy; el proxy reenvía `authorization` y `cookie` al backend.

Cambios:
- `page.tsx` (dashboard): `fetch('/api/documents?limit=1000')` en lugar de `apiFetch()`
- `lib/api-server.ts`: incluir header `cookie` en reenvío para Server Components
- Agregar link "Emitir DTE" en dashboard

## Tarea 2: Formulario de emisión completo

### Cambios en `emit-form.tsx`
1. **Modo direct/bridge funcional**: usar `useEmitDocument` o `useEmitBridgeDocument` según estado `mode`
2. **Cálculo de totales en tiempo real**: usar `calcularIVA` y `calcularTotal` de `@contachile/validators`, recalcular con `useMemo` al cambiar items
3. **Resumen visual**: mostrar neto, IVA (19%), total antes del botón emitir
4. **Validación RUT**: opcional, formatear input con `formatRUT`
5. **UX mejorada**: estado de carga, mensaje de éxito con folio, redirección a /documents

### Cambios en proxy
- Ruta `/api/dte/emit-bridge` ya existe, no requiere cambios
- Hook `useEmitBridgeDocument` ya existe, solo hay que usarlo

## Dependencias
- `@contachile/validators`: `calcularIVA`, `calcularTotal`, `formatRUT`
- `@contachile/db`: ya usado por API
- `@tanstack/react-query`: ya usado

## Testing
- Levantar `apps/api` y `apps/web`, verificar que dashboard carga stats reales
- Emitir DTE en modo directo y verificar folio asignado
- Emitir DTE en modo bridge y verificar trackId ACEPTA-*
