import { test, expect, Page } from '@playwright/test'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'test-e2e@contai.cl'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'

async function login(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
}

test.describe('Autenticación', () => {
  test('página de login carga con formulario y botón Google', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Contraseña')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Google/i })).toBeVisible()
  })

  test('muestra error con credenciales inválidas', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('no-existe@contai.cl')
    await page.getByLabel('Contraseña').fill('contraseña-incorrecta')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.locator('[class*="destructive"]')).toBeVisible({ timeout: 5_000 })
  })

  test('login con email redirige al dashboard', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('ruta protegida redirige a login si no autenticado', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('página de registro carga correctamente', async ({ page }) => {
    await page.goto('/sign-up')
    await expect(page.getByRole('heading', { name: /registr/i })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
  })

  test('usuario autenticado puede cerrar sesión', async ({ page }) => {
    await login(page)

    const logoutBtn = page.getByRole('button', { name: /salir|cerrar sesión|logout/i })
    const hasDirectLogout = await logoutBtn.isVisible()
    if (hasDirectLogout) {
      await logoutBtn.click()
    } else {
      await page.getByRole('button', { name: /cuenta|perfil/i }).click()
      await page.getByRole('menuitem', { name: /salir|cerrar/i }).click()
    }

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})
