"use client"

export default function ErrorBoundary({ error }: { error: Error & { digest?: string } }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-destructive">Algo salió mal</h2>
      <p className="text-muted-foreground">{error.message}</p>
      {error.digest && <p className="font-mono text-xs text-muted-foreground">Digest: {error.digest}</p>}
    </div>
  )
}
