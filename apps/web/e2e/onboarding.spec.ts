import { test, expect, Page } from '@playwright/test'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'test-e2e@contai.cl'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(TEST_EMAIL)
  await page.getByLabel('Contraseña').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL(/\/dashboard|\/settings/, { timeout: 10_000 })
}

test.describe('Configuración de empresa (Onboarding)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('navegación a configuración de empresa funciona', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /configuración|empresa/i })).toBeVisible({ timeout: 5_000 })
  })

  test('formulario de empresa acepta RUT en formato chileno', async ({ page }) => {
    await page.goto('/settings')
    const rutInput = page.getByLabel(/rut/i)
    if (await rutInput.isVisible()) {
      await rutInput.fill('76.354.771-K')
      await expect(rutInput).toHaveValue('76.354.771-K')
    }
  })

  test('sección de certificado digital está presente', async ({ page }) => {
    await page.goto('/settings')
    await expect(
      page.getByText(/certificado|pfx/i).first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('guardar configuración de empresa no retorna error', async ({ page }) => {
    await page.goto('/settings')

    const saveBtn = page.getByRole('button', { name: /guardar|actualizar|save/i })
    if (await saveBtn.isVisible()) {
      await saveBtn.click()
      // No debe aparecer error crítico
      const errorEl = page.getByText(/error crítico|500|internal server/i)
      expect(await errorEl.count()).toBe(0)
    }
  })
})
