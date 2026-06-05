import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ConfirmProvider, useConfirm } from "@/components/ui/confirm-provider"

function Harness({ onResult }: { onResult: (v: boolean) => void }) {
  const confirm = useConfirm()
  return (
    <button onClick={async () => onResult(await confirm({ title: "¿Seguro?" }))}>
      abrir
    </button>
  )
}

describe("useConfirm", () => {
  it("resuelve true al confirmar", async () => {
    const onResult = jest.fn()
    render(<ConfirmProvider><Harness onResult={onResult} /></ConfirmProvider>)
    fireEvent.click(screen.getByText("abrir"))
    expect(await screen.findByText("¿Seguro?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
  })

  it("resuelve false al cancelar", async () => {
    const onResult = jest.fn()
    render(<ConfirmProvider><Harness onResult={onResult} /></ConfirmProvider>)
    fireEvent.click(screen.getByText("abrir"))
    await screen.findByText("¿Seguro?")
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false))
  })
})
