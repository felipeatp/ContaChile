import { render, screen, fireEvent } from "@testing-library/react"
import { QueryState } from "@/components/ui/query-state"

describe("QueryState", () => {
  it("muestra el contenido cuando no hay loading/error/empty", () => {
    render(
      <QueryState isLoading={false} isError={false} isEmpty={false}>
        <div>contenido</div>
      </QueryState>
    )
    expect(screen.getByText("contenido")).toBeInTheDocument()
  })

  it("muestra estado de carga", () => {
    render(
      <QueryState isLoading isError={false} isEmpty={false}>
        <div>contenido</div>
      </QueryState>
    )
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.queryByText("contenido")).not.toBeInTheDocument()
  })

  it("muestra error con botón Reintentar que llama onRetry", () => {
    const onRetry = jest.fn()
    render(
      <QueryState isLoading={false} isError isEmpty={false} onRetry={onRetry}>
        <div>contenido</div>
      </QueryState>
    )
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("muestra mensaje vacío", () => {
    render(
      <QueryState isLoading={false} isError={false} isEmpty emptyMessage="Nada aquí">
        <div>contenido</div>
      </QueryState>
    )
    expect(screen.getByText("Nada aquí")).toBeInTheDocument()
  })
})
