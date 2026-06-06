import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// ── Security guard ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production" && process.env.DEV_BYPASS_AUTH === "true") {
  throw new Error("[SECURITY] DEV_BYPASS_AUTH=true is forbidden in production.")
}
// ──────────────────────────────────────────────────────────────────────────

const PUBLIC_ROUTES = ["/login", "/sign-up", "/forgot-password", "/reset-password", "/", "/blog", "/api/auth"]
const AUTH_ROUTES = ["/login", "/sign-up", "/forgot-password", "/reset-password"]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

const DEV_BYPASS = process.env.DEV_BYPASS_AUTH === "true"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  if (DEV_BYPASS) {
    return NextResponse.next()
  }

  // Chequeo optimista en el edge: solo verifica la presencia de la cookie de
  // sesión (sin tocar la BD, compatible con el runtime edge del middleware y con
  // Postgres local). La validación real de la sesión ocurre en los route
  // handlers / API (runtime Node), donde se consulta la BD.
  const sessionCookie = getSessionCookie(request)

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("returnBackUrl", request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  const activeCompanyId = request.cookies.get("active-company-id")?.value
  if (activeCompanyId) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-active-company-id", activeCompanyId)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
