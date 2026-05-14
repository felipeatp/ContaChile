import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/login(.*)', '/sign-up(.*)', '/'])
const isAuthRoute = createRouteMatcher(['/login(.*)', '/sign-up(.*)'])

const DEV_BYPASS = process.env.DEV_BYPASS_AUTH === 'true'

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth()

  // Bypass de desarrollo: permite acceso sin auth a rutas protegidas
  if (DEV_BYPASS && !userId) {
    return NextResponse.next()
  }

  // Usuario ya autenticado visitando login/sign-up → al dashboard
  if (userId && isAuthRoute(request)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Usuario no autenticado visitando ruta protegida → al login
  if (!isPublicRoute(request) && !userId) {
    return (await auth()).redirectToSignIn({ returnBackUrl: request.url })
  }
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
