import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_ROUTES = ["/login", "/sign-up", "/", "/blog"]
const AUTH_ROUTES = ["/login", "/sign-up"]

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

  // Rutas públicas: permitir siempre
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Bypass de desarrollo
  if (DEV_BYPASS) {
    return NextResponse.next()
  }

  // Verificar sesión via Better Auth
  const sessionCookie =
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("session_token")?.value

  if (!sessionCookie) {
    // No autenticado en ruta protegida → login
    if (!isPublicRoute(pathname)) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("returnBackUrl", request.url)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Validar sesión contra la API de Better Auth
  try {
    const sessionRes = await fetch(
      new URL("/api/auth/get-session", request.url),
      {
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      }
    )

    const session = sessionRes.ok ? await sessionRes.json() : null

    if (!session?.user) {
      // Sesión inválida
      if (!isPublicRoute(pathname)) {
        const loginUrl = new URL("/login", request.url)
        loginUrl.searchParams.set("returnBackUrl", request.url)
        return NextResponse.redirect(loginUrl)
      }
      return NextResponse.next()
    }

    // Usuario autenticado visitando login/sign-up → dashboard
    if (isAuthRoute(pathname)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    return NextResponse.next()
  } catch {
    // Error de red al validar sesión
    if (!isPublicRoute(pathname)) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("returnBackUrl", request.url)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
