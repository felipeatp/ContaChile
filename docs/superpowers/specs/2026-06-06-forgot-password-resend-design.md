# Forgot Password con Resend (Design)

**Fecha:** 2026-06-06
**Estado:** Aprobado
**Decisión clave:** enviar el email de reset con Resend **directo desde el web** (`auth-edge`), no vía la API.

## Contexto

El login email/contraseña funciona pero no hay recuperación de contraseña. Better Auth
1.6.11 trae el flujo completo (`requestPasswordReset` → email con token →
`/api/auth/reset-password/:token` → `resetPassword`); solo falta el callback
`sendResetPassword` y las páginas. El email/Resend hoy vive solo en la API
(`apps/api/src/lib/email.ts`), pero el auth del web corre en `apps/web/lib/auth-edge.ts`,
así que el envío se hace ahí. Resend usa HTTP fetch → compatible con edge/CF y Node.

## Componentes

- **`apps/web/lib/email.ts`** (nuevo): `sendPasswordResetEmail({ to, url, userName? })`.
  Usa Resend con `RESEND_API_KEY` y `EMAIL_FROM` (default `ContaChile <noreply@contachile.cl>`).
  Sin API key (o `test-key`) → log + no-op (fallback dev, como `StubEmailService`).
- **`apps/web/lib/auth-edge.ts`** (mod): en `emailAndPassword` agregar
  `sendResetPassword: async ({ user, url }) => sendPasswordResetEmail({ to: user.email, url, userName: user.name })`
  y `resetPasswordTokenExpiresIn: 3600`.
- **`apps/web/app/(auth)/forgot-password/page.tsx`** (nuevo): form de email →
  `authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })`. Siempre
  muestra éxito (anti-enumeración). Estilo editorial como login.
- **`apps/web/app/(auth)/reset-password/page.tsx`** (nuevo): lee `token` del query
  (Suspense + `useSearchParams`); form nueva contraseña + confirmar + toggle ver +
  indicador de fuerza (reusa `@/lib/password-strength`); →
  `authClient.resetPassword({ newPassword, token })` → éxito → redirige a `/login`.
  Sin token o `?error=` → mensaje "enlace inválido o expirado" + link a `/forgot-password`.
- **`apps/web/app/(auth)/login/[[...rest]]/login-client.tsx`** (mod): link
  "¿Olvidaste tu contraseña?" → `/forgot-password`.
- **`apps/web/middleware.ts`** (mod): agregar `/forgot-password` y `/reset-password` a
  `PUBLIC_ROUTES`.
- **`apps/web/lib/auth-client.ts`** (mod): exportar `requestPasswordReset` y `resetPassword`.
- **env example** (`.dev.vars.example`, `.env.local.example`): documentar `RESEND_API_KEY`
  y `EMAIL_FROM`.

## Flujo de datos

1. `/forgot-password` → `requestPasswordReset({ email, redirectTo: "/reset-password" })`.
2. Better Auth crea verification `reset-password:{token}` y llama `sendResetPassword` con
   `url = ${baseURL}/api/auth/reset-password/{token}?callbackURL=/reset-password`.
3. `sendPasswordResetEmail` envía el correo (Resend) con ese link.
4. Click → `GET /api/auth/reset-password/:token` → Better Auth valida (no expirado) →
   redirige a `/reset-password?token={token}` (o `?error=INVALID_TOKEN`).
5. `/reset-password` lee `token` → `resetPassword({ newPassword, token })` → `/login`.

## Manejo de errores

- `requestPasswordReset`: la UI siempre muestra éxito (no revela si el email existe).
- `/reset-password` sin `token` o con `?error=` → mensaje de enlace inválido/expirado.
- `resetPassword` falla (contraseña débil, token expirado) → error mapeado, inline.
- Resend falla → se loguea; el usuario igual ve éxito en el request.

## Testing (TDD donde aplica)

- **Unit (jest, web):** `lib/email.ts` — arma el payload correcto (subject/to/from/link) y
  hace no-op sin API key (mockeando el cliente Resend / `fetch`).
- **E2E (Playwright, acotado):** `/forgot-password` envía → mensaje de éxito;
  `/reset-password` sin token → mensaje de enlace inválido. El round-trip real del email
  es CI/manual (requiere `RESEND_API_KEY` + dominio verificado).
- Gate: `tsc --noEmit` sin errores nuevos.

## Constraint

Resend requiere **dominio verificado** (`contachile.cl`) para enviar en producción. En dev
sin dominio verificado, Resend solo entrega al email dueño de la cuenta y desde
`onboarding@resend.dev`. `EMAIL_FROM` queda configurable. Se necesita una `RESEND_API_KEY`
real para enviar de verdad; sin ella el flujo funciona pero el email es no-op (logueado).

## No-objetivos (YAGNI)

- Cambio de contraseña estando logueado (feature aparte).
- Rate limiting custom del endpoint (Better Auth ya aplica su rate limit).
