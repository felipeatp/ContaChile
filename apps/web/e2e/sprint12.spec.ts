import { test, expect, Page } from "@playwright/test"

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "test-e2e@contai.cl"
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "TestPassword123!"

async function login(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(TEST_EMAIL)
  await page.getByLabel("Contraseña").fill(TEST_PASSWORD)
  await page.getByRole("button", { name: "Iniciar sesión" }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
}

test.describe("Sprint 12 — accesibilidad del menú de usuario", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test("se abre con teclado y cierra con Escape", async ({ page }) => {
    await page.goto("/dashboard")
    const trigger = page.getByRole("button", { name: "Menú de usuario" })
    await trigger.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("menuitem", { name: /cambiar perfil/i })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menuitem", { name: /cambiar perfil/i })).toBeHidden()
  })

  test("se abre por click (touch, sin hover)", async ({ page }) => {
    await page.goto("/dashboard")
    await page.getByRole("button", { name: "Menú de usuario" }).click()
    await expect(page.getByRole("menuitem", { name: /cerrar sesión/i })).toBeVisible()
  })
})
