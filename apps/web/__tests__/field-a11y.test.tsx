import React from "react"
import { render, screen } from "@testing-library/react"
import { Field, Label } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

describe("Field — accesibilidad", () => {
  it("Input dentro de Field recibe aria-describedby del error", () => {
    render(
      <Field label="Nombre" error="El nombre es obligatorio">
        <Input data-testid="input" />
      </Field>
    )

    const input = screen.getByTestId("input")
    const errorId = input.getAttribute("aria-describedby")
    expect(errorId).toBeTruthy()
    expect(screen.getByRole("alert")).toHaveAttribute("id", errorId)
    expect(input).toHaveAttribute("aria-invalid", "true")
  })

  it("Select dentro de Field recibe aria-describedby del error", () => {
    render(
      <Field label="País" error="Selecciona un país">
        <Select data-testid="select">
          <option value="">Seleccionar</option>
          <option value="cl">Chile</option>
        </Select>
      </Field>
    )

    const select = screen.getByTestId("select")
    const errorId = select.getAttribute("aria-describedby")
    expect(errorId).toBeTruthy()
    expect(screen.getByRole("alert")).toHaveAttribute("id", errorId)
    expect(select).toHaveAttribute("aria-invalid", "true")
  })

  it("sin error no aplica aria-invalid ni aria-describedby", () => {
    render(
      <Field label="Email">
        <Input data-testid="input" />
      </Field>
    )

    const input = screen.getByTestId("input")
    expect(input).not.toHaveAttribute("aria-invalid")
    expect(input).not.toHaveAttribute("aria-describedby")
  })

  it("concatena aria-describedby manual con el del error", () => {
    render(
      <Field label="RUT" error="RUT inválido">
        <Input data-testid="input" aria-describedby="rut-hint" />
      </Field>
    )

    const input = screen.getByTestId("input")
    const describedBy = input.getAttribute("aria-describedby")
    expect(describedBy).toContain("rut-hint")
  })
})

describe("Label", () => {
  it("muestra asterisco cuando required=true", () => {
    render(<Label required>Email</Label>)
    expect(screen.getByText("*")).toBeInTheDocument()
  })

  it("muestra hint cuando se proporciona", () => {
    render(<Label hint="opcional">Teléfono</Label>)
    expect(screen.getByText("opcional")).toBeInTheDocument()
  })
})
