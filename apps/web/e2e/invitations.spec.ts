import { test, expect, Page } from '@playwright/test'

const OWNER_EMAIL = process.env.E2E_TEST_EMAIL ?? 'test-e2e@contai.cl'
const OWNER_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'
const INVITED_EMAIL = process.env.E2E_INVITED_EMAIL ?? 'invited-e2e@contai.cl'

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
}

test.describe('Invitaciones de equipo', () => {
  test('página /invitar carga con formulario de email', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await page.goto('/invitar')
    await expect(page.getByRole('heading', { name: /invit/i })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByLabel(/email/i)).toBeVisible()
  })

  test('owner puede enviar invitación con email válido', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await page.goto('/invitar')

    await page.getByLabel(/email/i).fill(INVITED_EMAIL)

    const rolSelect = page.getByLabel(/rol/i)
    if (await rolSelect.isVisible()) {
      await rolSelect.selectOption('viewer')
    }

    await page.getByRole('button', { name: /invitar|enviar/i }).click()

    await expect(
      page.getByText(/invitación enviada|invitation sent|se envió|éxito/i).or(
        page.locator('[class*="success"], [role="status"]').first()
      ).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('token de invitación inválido muestra error', async ({ page }) => {
    await page.goto('/invitacion/token-fake-invalido-abc123')
    await expect(
      page.getByText(/invalid|inválid|expirada|no válida|not found/i).or(
        page.getByRole('heading', { name: /error/i })
      ).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('formulario de invitación valida email requerido', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD)
    await page.goto('/invitar')

    // Submit vacío
    await page.getByRole('button', { name: /invitar|enviar/i }).click()

    // El email input debe tener validación nativa o mensaje de error
    const emailInput = page.getByLabel(/email/i)
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(isInvalid).toBeTruthy()
  })
})
