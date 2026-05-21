# PWA — ContaChile Web App

**Fecha:** 2026-05-21  
**Estado:** Aprobado  
**Alcance:** `apps/web` — agregar capacidades Progressive Web App a la app Next.js 14 existente

## Contexto

El cliente móvil React Native (Expo) presentó errores de compilación Kotlin irresolubles en EAS Build. La app web ya tiene paridad funcional con el flujo móvil previsto. En lugar de continuar depurando el build nativo, se implementa PWA sobre la app web existente: instalable en home screen, acceso a cámara vía `getUserMedia`, y caché offline básico.

## Arquitectura

### Librería elegida: `@ducanh2912/next-pwa`

Envuelve Workbox. Se integra en `next.config.js` con un wrapper `withPWA()`. Genera el service worker (`public/sw.js`) automáticamente en build. Elegida sobre `serwist` (más nueva, menos recursos) y service worker manual (más trabajo, invalidación de caché propensa a errores).

### Archivos afectados

| Archivo | Acción | Descripción |
|---|---|---|
| `apps/web/next.config.js` | Modificar | Envolver config con `withPWA()` |
| `apps/web/public/manifest.json` | Crear | Metadatos PWA: nombre, iconos, colores, modo standalone |
| `apps/web/public/icons/` | Crear | Íconos 192×192, 512×512, 512×512 maskable |
| `apps/web/app/layout.tsx` | Modificar | Agregar `manifest` y `themeColor` al objeto `metadata` de Next.js |
| `apps/web/app/(app)/camera/page.tsx` | Crear | Página cámara: captura múltiple, preview, envío al OCR |
| `apps/web/lib/use-install-prompt.ts` | Crear | Hook que captura `beforeinstallprompt` y expone `prompt()` e `isInstallable` |
| `apps/web/components/layout/header.tsx` | Modificar | Agregar botón de instalación (solo visible cuando `isInstallable === true`) |
| `apps/web/public/sw.js` | Auto-generado | Artefacto de build de Workbox; no se edita manualmente |
| `apps/web/public/workbox-*.js` | Auto-generado | Artefacto de build de Workbox; no se edita manualmente |
| `apps/web/.gitignore` | Modificar | Ignorar `public/sw.js` y `public/workbox-*.js` |

### Dependencias nuevas

```
@ducanh2912/next-pwa   (devDependency)
```

## Web Manifest

`apps/web/public/manifest.json`:

```json
{
  "name": "ContaChile",
  "short_name": "ContaChile",
  "description": "Facturación electrónica y contabilidad para Chile",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#0f172a",
  "background_color": "#0f172a",
  "categories": ["finance", "business"],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- `start_url: "/dashboard"` — al abrir desde home screen va directo al dashboard, no al landing
- `display: "standalone"` — sin barra del navegador
- `theme_color: "#0f172a"` — coincide con el color del sidebar oscuro de ContaChile
- El ícono maskable incluye padding para launchers de Android que recortan en círculo/squircle

`app/layout.tsx` — adición al objeto `metadata`:

```ts
manifest: "/manifest.json",
themeColor: "#0f172a",
appleWebApp: {
  capable: true,
  statusBarStyle: "black-translucent",
  title: "ContaChile",
},
```

## Service Worker y Estrategia de Caché

`next.config.js` actualizado:

```js
const withPWA = require('@ducanh2912/next-pwa').default

module.exports = withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)
```

El SW se deshabilita en desarrollo para no interferir con HMR.

Workbox aplica estas estrategias automáticamente:

| Recurso | Estrategia | Comportamiento |
|---|---|---|
| JS/CSS/fuentes (estáticos `/_next/static/`) | CacheFirst | Sirve desde caché; se invalida con nuevo deploy (hash en filename) |
| Páginas Next.js (`/_next/`) | StaleWhileRevalidate | Sirve caché inmediatamente, actualiza en segundo plano |
| Rutas API (`/api/**`) | NetworkFirst | Intenta red primero; si falla sirve última respuesta cacheada |
| Imágenes | CacheFirst | Caché hasta 30 días, máx 60 entradas |

**Qué funciona offline:** dashboard, listado de documentos, reportes (datos de última visita).  
**Qué requiere conexión:** crear DTE, subir documentos al OCR, cualquier acción de escritura.

## Cámara

`app/(app)/camera/page.tsx` — flujo completo:

1. Al cargar, solicita permiso de cámara (`getUserMedia` con `facingMode: 'environment'` para cámara trasera)
2. Muestra preview en tiempo real en `<video autoPlay playsInline>`
3. Botón "Capturar" → dibuja frame en `<canvas>` → guarda blob en estado local como miniatura
4. El usuario puede capturar N fotos antes de enviar (lista de miniaturas con botón de eliminar por foto)
5. Botón "Enviar al OCR" → envía todas las fotos en una sola llamada `POST /api/ocr` como `multipart/form-data` (campo `files[]` con todos los blobs)
6. Loading state durante el procesamiento
7. Al completar, redirige al listado de documentos creados

```tsx
// Estructura del estado
const [photos, setPhotos] = useState<{ id: string; blob: Blob; preview: string }[]>([])
const [isProcessing, setIsProcessing] = useState(false)
```

El componente se puede testear unitariamente mockeando `navigator.mediaDevices.getUserMedia`.

## Prompt de Instalación

### Hook `lib/use-install-prompt.ts`

Captura el evento `beforeinstallprompt` (disparado por el navegador cuando la PWA es instalable) y lo guarda en una ref. Expone:

- `isInstallable: boolean` — true cuando el evento está disponible y la app no está instalada
- `promptInstall: () => Promise<void>` — dispara el prompt nativo del OS

El hook escucha también `appinstalled` para limpiar el estado tras una instalación exitosa.

### Botón en el header

`components/layout/header.tsx` — se agrega un botón con `DownloadIcon` de lucide-react que:
- Solo renderiza cuando `isInstallable === true`
- Al hacer clic llama a `promptInstall()`
- No aparece si la app ya está instalada (el navegador no dispara `beforeinstallprompt` en ese caso)

No hay banner ni modal — solo el ícono en el header, discreto y no bloqueante.

## Íconos

Los tres archivos PNG deben generarse desde el logo de ContaChile. Tamaños requeridos:

- `public/icons/icon-192.png` — 192×192px
- `public/icons/icon-512.png` — 512×512px  
- `public/icons/icon-512-maskable.png` — 512×512px con padding del 10% (zona segura para recorte de launchers Android)

Si no existe aún un logo vectorial, se puede generar un placeholder con fondo `#0f172a` y texto "CC" para las pruebas iniciales.

## Testing

No hay tests automáticos para el service worker ni la instalación (requieren navegador real con HTTPS). Verificación manual:

| Check | Herramienta |
|---|---|
| Manifest válido + íconos | Chrome DevTools → Application → Manifest |
| Service Worker registrado y activo | DevTools → Application → Service Workers |
| Lighthouse PWA score ≥ 90 | DevTools → Lighthouse → "Progressive Web App" |
| Instalación en Android | Chrome → menú → "Agregar a pantalla de inicio" |
| Cámara funciona desde home screen | Abrir `/camera` desde app instalada |
| Offline: dashboard visible | DevTools → Network → Offline → recargar `/dashboard` |
| Offline: API cacheada | DevTools → Network → Offline → navegar a documentos ya visitados |

Test unitario del componente cámara:
- Mock de `navigator.mediaDevices.getUserMedia`
- Verifica que "Enviar al OCR" esté deshabilitado con 0 fotos
- Verifica que las miniaturas aparezcan tras capturar
- Verifica que se llame al endpoint OCR con los blobs correctos

## Secuencia de implementación

1. Instalar `@ducanh2912/next-pwa` y actualizar `next.config.js`
2. Crear `public/manifest.json` y los íconos placeholder
3. Actualizar `app/layout.tsx` con manifest y themeColor en metadata
4. Agregar `public/sw.js` y `public/workbox-*.js` a `.gitignore`
5. Crear `lib/use-install-prompt.ts`
6. Actualizar `components/layout/header.tsx` con botón de instalación
7. Crear `app/(app)/camera/page.tsx` con flujo completo de captura múltiple
8. Verificar con Lighthouse y prueba manual en Android

## Restricciones

- PWA requiere HTTPS en producción (el service worker no se registra en HTTP). En desarrollo local se deshabilita el SW explícitamente.
- `getUserMedia` con `facingMode: 'environment'` solo funciona en HTTPS o `localhost`.
- Los íconos deben ser PNG (no SVG) para máxima compatibilidad con launchers de Android/iOS.
- iOS Safari soporta "Agregar al inicio" pero no el evento `beforeinstallprompt`; el botón de instalación en header no aparecerá en iOS. El usuario en iOS debe instalarlo manualmente desde el menú de compartir.
