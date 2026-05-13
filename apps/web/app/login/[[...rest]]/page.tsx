import { SignIn } from "@clerk/nextjs"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <SignIn
        path="/login"
        routing="path"
        forceRedirectUrl="/"
        signUpUrl="/sign-up"
      />
    </div>
  )
}
