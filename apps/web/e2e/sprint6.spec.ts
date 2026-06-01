import { test, expect, Page } from '@playwright/test'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'test-e2e@contai.cl'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(TEST_EMAIL)
  await page.getByLabel('Contraseña').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
}

test.describe('Sprint 6 — UX no técnicos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('RUT inválido en formulario trabajador muestra error en línea, no alert del browser', async ({
    page,
  }) => {
    // Navigate to trabajadores page
    await page.goto('/remuneraciones/trabajadores')
    await expect(page.getByRole('heading', { name: /trabajadores/i })).toBeVisible({ timeout: 10_000 })

    // Open the form
    await page.getByRole('button', { name: /nuevo trabajador/i }).click()
    await expect(page.getByText('Nuevo trabajador')).toBeVisible()

    // Type an invalid RUT (wrong check digit)
    const rutInput = page.getByPlaceholder('12.345.678-5')
    await rutInput.fill('12345678-0')

    // Click save to trigger validation
    await page.getByRole('button', { name: /^guardar$/i }).click()

    // Inline error should appear — NOT a browser alert
    await expect(page.getByText(/RUT inválido/i)).toBeVisible()
  })

  test('"Generar mes" abre modal de confirmación antes de ejecutar', async ({ page }) => {
    await page.goto('/remuneraciones/liquidaciones')
    await expect(page.getByRole('heading', { name: /liquidaciones/i })).toBeVisible({ timeout: 10_000 })

    // Track if the generate API was called before confirmation
    let generateCalled = false
    await page.route('**/api/payroll/generate', async (route) => {
      generateCalled = true
      await route.continue()
    })

    // Click "Generar mes"
    await page.getByRole('button', { name: /generar mes/i }).click()

    // Confirmation modal should appear
    await expect(page.getByText('¿Generar liquidaciones del mes?')).toBeVisible()

    // API should NOT have been called yet
    expect(generateCalled).toBe(false)

    // Cancel — modal should close, API still not called
    await page.getByRole('button', { name: /^cancelar$/i }).click()
    await expect(page.getByText('¿Generar liquidaciones del mes?')).not.toBeVisible()
    expect(generateCalled).toBe(false)
  })
})
