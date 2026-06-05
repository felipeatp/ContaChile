export default function AppLoading() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <div className="h-3 w-40 rounded-sm bg-secondary" />
        <div className="h-9 w-72 rounded-sm bg-secondary" />
        <div className="h-4 w-96 rounded-sm bg-secondary/60" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-sm border border-border bg-card" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 rounded-sm border border-border bg-card" />
        <div className="h-64 rounded-sm border border-border bg-card" />
      </div>
    </div>
  )
}
