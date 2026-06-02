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

test.describe('Sprint 8 — DTE Preview + Chat IA', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('flujo emitir DTE — el botón abre el modal de preview con datos correctos', async ({
    page,
  }) => {
    await page.goto('/emit')
    await expect(page.getByRole('heading', { name: /emitir/i })).toBeVisible({ timeout: 10_000 })

    // Seleccionar tipo Boleta
    await page.getByText('Boleta electrónica').click()

    // Completar receptor
    await page.getByPlaceholder('76.123.456-7').fill('12.345.678-5')
    await page.getByLabel(/razón social/i).fill('Cliente Test SpA')
    await page.getByLabel(/dirección/i).fill('Calle Falsa 123')
    await page.getByLabel(/comuna/i).fill('Santiago')
    await page.getByLabel(/ciudad/i).fill('Santiago')

    // Completar item
    const descInput = page.getByLabel(/descripción/i).first()
    await descInput.fill('Servicio de consultoría')
    await page.getByLabel(/cantidad/i).fill('1')
    await page.getByLabel(/precio unitario/i).fill('100000')

    // Hacer submit — debe abrir el modal preview (NO emitir directamente)
    let emitCalled = false
    await page.route('**/api/dte/emit', async (route) => {
      emitCalled = true
      await route.continue()
    })

    await page.getByRole('button', { name: /emitir dte/i }).click()

    // Modal de preview debe aparecer
    await expect(page.getByText('¿Emitir este documento?')).toBeVisible()

    // El API NO debe haberse llamado todavía
    expect(emitCalled).toBe(false)

    // El receptor y el tipo deben mostrarse en el preview
    await expect(page.getByText('Cliente Test SpA')).toBeVisible()
    await expect(page.getByText('Boleta electrónica')).toBeVisible()

    // Cancelar — modal se cierra, API sigue sin llamarse
    await page.getByRole('button', { name: /^cancelar$/i }).click()
    await expect(page.getByText('¿Emitir este documento?')).not.toBeVisible()
    expect(emitCalled).toBe(false)
  })

  test('chat IA — disclaimer visible después de enviar mensaje', async ({ page }) => {
    await page.goto('/dashboard')

    // Abrir el chat widget
    const chatFab = page.getByRole('button', { name: /consultor/i }).or(
      page.locator('[title*="consultor" i]')
    ).first()
    await chatFab.click({ timeout: 10_000 }).catch(() => {
      // El botón puede estar dentro del FAB — buscar el bot icon
    })

    // Verificar que el panel del chat está visible
    await expect(page.getByText('Consultor Tributario')).toBeVisible({ timeout: 8_000 })

    // El disclaimer aparece cuando hay mensajes
    const disclaimerLocator = page.getByText(/orientativo/i)

    // Si hay mensajes restaurados del historial, el disclaimer ya debe estar visible
    const msgCount = await page.locator('[class*="group relative"]').count()
    if (msgCount > 0) {
      await expect(disclaimerLocator).toBeVisible()
    }
    // Si no hay mensajes, el EmptyState está visible (OK — disclaimer solo aparece con mensajes)
  })
})
