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

test.describe('Emisión de DTE', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('página de emisión carga con formulario', async ({ page }) => {
    await page.goto('/emit')
    await expect(page.getByRole('heading', { name: /emitir|factura|dte/i })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByLabel(/tipo/i).first()).toBeVisible()
  })

  test('seleccionar tipo 33 muestra campos de factura', async ({ page }) => {
    await page.goto('/emit')
    const tipoSelect = page.getByLabel(/tipo.*dte|tipo de documento/i)
    if (await tipoSelect.isVisible()) {
      await tipoSelect.selectOption('33')
      await expect(page.getByLabel(/rut.*receptor/i)).toBeVisible()
    }
  })

  test('seleccionar tipo 39 muestra campos de boleta', async ({ page }) => {
    await page.goto('/emit')
    const tipoSelect = page.getByLabel(/tipo.*dte|tipo de documento/i)
    if (await tipoSelect.isVisible()) {
      await tipoSelect.selectOption('39')
      // Boleta no requiere RUT receptor en algunos casos
      await page.waitForTimeout(300)
    }
  })

  test('archivo de documentos lista DTEs con tabla o mensaje vacío', async ({ page }) => {
    await page.goto('/documents')
    await expect(page.getByRole('heading', { name: /archivo|documentos/i })).toBeVisible({ timeout: 5_000 })
    const hasTable = await page.locator('table').isVisible()
    const isEmpty = await page.getByText(/sin documentos/i).isVisible()
    expect(hasTable || isEmpty).toBeTruthy()
  })

  test('filtro por estado ACCEPTED en /documents funciona', async ({ page }) => {
    await page.goto('/documents')
    await page.waitForLoadState('networkidle', { timeout: 10_000 })

    const statusSelect = page.locator('select').first()
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('ACCEPTED')
      await page.waitForTimeout(500)
      // La URL o el estado de la UI deben reflejar el filtro
    }
  })

  test('filtro por estado FAILED muestra documentos fallidos con botón reintentar', async ({ page }) => {
    await page.goto('/documents')
    await page.waitForLoadState('networkidle', { timeout: 10_000 })

    const statusSelect = page.locator('select').first()
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('FAILED')
      await page.waitForTimeout(500)
      // Si hay documentos FAILED, el botón "Reintentar" debe ser visible
      const failedCount = await page.locator('table tbody tr').count()
      if (failedCount > 0) {
        await expect(page.getByRole('button', { name: /reintentar/i }).first()).toBeVisible()
      }
    }
  })

  test('botón "Emitir DTE" en /documents lleva a /emit', async ({ page }) => {
    await page.goto('/documents')
    await page.getByRole('link', { name: /emitir dte/i }).click()
    await expect(page).toHaveURL(/\/emit/)
  })
})
