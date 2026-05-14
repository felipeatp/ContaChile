import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/login(.*)', '/sign-up(.*)', '/'])

export default clerkMiddleware((auth, request) => {
  const { userId } = auth()

  if (!isPublicRoute(request) && !userId) {
    return auth().redirectToSignIn({ returnBackUrl: request.url })
  }
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
