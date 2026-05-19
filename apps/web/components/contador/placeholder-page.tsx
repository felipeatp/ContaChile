import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Construction } from "lucide-react"

export function PlaceholderPage({
  title,
  description,
  empresaLink,
}: {
  title: string
  description: string
  empresaLink?: string
}) {
  return (
    <div className="space-y-6 animate-fade-up">
      <section>
        <span className="eyebrow">Contador</span>
        <h1 className="font-display text-3xl font-semibold tracking-tightest mt-2">{title}</h1>
        <p className="text-muted-foreground mt-2">{description}</p>
      </section>

      <div className="rounded-lg border border-border p-12 text-center space-y-4">
        <Construction className="h-12 w-12 mx-auto text-muted-foreground" />
        <p className="text-lg font-medium">En construcción</p>
        <p className="text-muted-foreground max-w-md mx-auto">
          Esta vista para contadores está en desarrollo. Pronto podrás acceder a{" "}
          {title.toLowerCase()} desde tu dashboard contable.
        </p>
        {empresaLink && (
          <Button asChild variant="outline">
            <Link href={empresaLink}>Ver versión empresa →</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
