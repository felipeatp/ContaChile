import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_ROUTES = ["/login", "/sign-up", "/", "/blog", "/api/auth"]
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

  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  if (DEV_BYPASS) {
    return NextResponse.next()
  }

  try {
    // Dynamic import so auth-edge.ts is evaluated after CF env vars are
    // populated by init() — avoids neon("") at module load time.
    const { auth } = await import("@/lib/auth-edge")
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
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
  } catch (err) {
    console.error("[middleware] session check failed:", err)
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("returnBackUrl", request.url)
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
