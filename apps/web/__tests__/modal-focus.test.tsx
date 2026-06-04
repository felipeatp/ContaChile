import React, { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Modal } from "@/components/ui/modal"

describe("Modal — focus management", () => {
  function TestModal({ openInitially = false }) {
    const [open, setOpen] = useState(openInitially)
    return (
      <>
        <button data-testid="trigger" onClick={() => setOpen(true)}>
          Abrir
        </button>
        <Modal open={open} onClose={() => setOpen(false)} title="Título">
          <input data-testid="first-input" placeholder="Nombre" />
          <input data-testid="second-input" placeholder="Email" />
          <button data-testid="inside-btn" onClick={() => setOpen(false)}>
            Cerrar
          </button>
        </Modal>
      </>
    )
  }

  it("mueve el foco al primer elemento focusable al abrirse", async () => {
    render(<TestModal />)
    await userEvent.click(screen.getByTestId("trigger"))

    // El primer elemento focusable es el botón "Cerrar" en el header
    await waitFor(() =>
      expect(screen.getByLabelText("Cerrar")).toHaveFocus()
    )
  })

  it("mantiene el foco dentro del modal al presionar Tab (ciclo)", async () => {
    render(<TestModal openInitially />)
    const closeBtn = screen.getByLabelText("Cerrar")
    const first = screen.getByTestId("first-input")
    const second = screen.getByTestId("second-input")
    const btn = screen.getByTestId("inside-btn")

    await waitFor(() => expect(closeBtn).toHaveFocus())

    // Tab hacia adelante: cerrar → first-input → second-input → inside-btn → ciclo a cerrar
    await userEvent.tab()
    expect(first).toHaveFocus()

    await userEvent.tab()
    expect(second).toHaveFocus()

    await userEvent.tab()
    expect(btn).toHaveFocus()

    await userEvent.tab()
    expect(closeBtn).toHaveFocus()
  })

  it("Shift+Tab cicla hacia atrás", async () => {
    render(<TestModal openInitially />)
    const closeBtn = screen.getByLabelText("Cerrar")
    const last = screen.getByTestId("inside-btn")

    await waitFor(() => expect(closeBtn).toHaveFocus())

    // Desde el primer elemento, Shift+Tab va al último (ciclo)
    await userEvent.tab({ shift: true })
    expect(last).toHaveFocus()
  })

  it("cierra con Escape", async () => {
    render(<TestModal openInitially />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })
})
