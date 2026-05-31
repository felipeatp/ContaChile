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

test.describe('Dashboard y módulos principales', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('dashboard carga sin errores críticos', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    const errorEl = page.getByText(/error interno|500|internal server error/i)
    expect(await errorEl.count()).toBe(0)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('panel de alertas de vencimiento carga', async ({ page }) => {
    await page.goto('/alertas')
    await expect(page.getByRole('heading', { name: /alert|vencimiento/i })).toBeVisible({ timeout: 5_000 })
  })

  test('consultor IA (/ai) carga con input de chat', async ({ page }) => {
    await page.goto('/ai')
    await expect(
      page.getByRole('heading', { name: /consult|IA|asistente/i })
    ).toBeVisible({ timeout: 5_000 })
    await expect(
      page.getByRole('textbox').or(page.getByPlaceholder(/pregunta|consulta/i)).first()
    ).toBeVisible()
  })

  test('módulo de conciliación bancaria (/banco/conciliacion) carga', async ({ page }) => {
    await page.goto('/banco/conciliacion')
    await expect(page.getByRole('heading', { name: /conciliación|banco/i })).toBeVisible({ timeout: 5_000 })
  })

  test('módulo F29 carga con formulario', async ({ page }) => {
    await page.goto('/f29')
    await expect(page.getByRole('heading', { name: /f29/i })).toBeVisible({ timeout: 5_000 })
  })

  test('módulo de remuneraciones carga', async ({ page }) => {
    await page.goto('/remuneraciones/trabajadores')
    await expect(page.getByRole('heading', { name: /remuner|trabajador/i })).toBeVisible({ timeout: 5_000 })
  })

  test('navegación tiene enlaces a módulos principales', async ({ page }) => {
    await page.goto('/dashboard')
    for (const name of ['Documentos', 'Dashboard']) {
      await expect(
        page.getByRole('link', { name: new RegExp(name, 'i') }).first()
      ).toBeVisible({ timeout: 5_000 })
    }
  })
})
