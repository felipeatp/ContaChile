# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sprint11-a11y.spec.ts >> Accesibilidad WCAG AA — Sprint 11 >> dashboard — cero violaciones WCAG AA
- Location: e2e\sprint11-a11y.spec.ts:27:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - paragraph [ref=e4]: Toca el ícono ⊕ en la barra del browser para instalar
    - generic [ref=e8]:
      - generic [ref=e9]:
        - heading "Iniciar sesión" [level=1] [ref=e10]
        - paragraph [ref=e11]: Accede a tu cuenta de ContAI
      - generic [ref=e12]: Error al iniciar sesión
      - generic [ref=e13]:
        - generic [ref=e14]:
          - text: Email
          - textbox "Email" [ref=e15]:
            - /placeholder: tu@email.com
            - text: test-e2e@contai.cl
        - generic [ref=e16]:
          - text: Contraseña
          - textbox "Contraseña" [ref=e17]:
            - /placeholder: ••••••••
            - text: TestPassword123!
        - button "Iniciar sesión" [ref=e18] [cursor=pointer]
      - generic [ref=e23]: O
      - generic [ref=e24]:
        - button "Continuar con Google" [ref=e25] [cursor=pointer]:
          - img [ref=e26]
          - text: Continuar con Google
        - button "Continuar con Microsoft" [ref=e31] [cursor=pointer]:
          - img [ref=e32]
          - text: Continuar con Microsoft
      - paragraph [ref=e37]:
        - text: ¿No tienes cuenta?
        - link "Regístrate" [ref=e38] [cursor=pointer]:
          - /url: /sign-up
  - button "Open Next.js Dev Tools" [ref=e44] [cursor=pointer]:
    - img [ref=e45]
  - alert [ref=e48]
```

# Test source

```ts
  1  | import { test, expect, Page } from '@playwright/test'
  2  | import AxeBuilder from '@axe-core/playwright'
  3  | 
  4  | const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'test-e2e@contai.cl'
  5  | const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'
  6  | 
  7  | async function login(page: Page) {
  8  |   await page.goto('/login')
  9  |   await page.getByLabel('Email').fill(TEST_EMAIL)
  10 |   await page.getByLabel('Contraseña').fill(TEST_PASSWORD)
  11 |   await page.getByRole('button', { name: 'Iniciar sesión' }).click()
> 12 |   await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
     |              ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  13 | }
  14 | 
  15 | test.describe('Accesibilidad WCAG AA — Sprint 11', () => {
  16 |   test('login — cero violaciones WCAG AA', async ({ page }) => {
  17 |     await page.goto('/login')
  18 |     await page.waitForLoadState('networkidle')
  19 | 
  20 |     const accessibilityScanResults = await new AxeBuilder({ page })
  21 |       .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
  22 |       .analyze()
  23 | 
  24 |     expect(accessibilityScanResults.violations).toEqual([])
  25 |   })
  26 | 
  27 |   test('dashboard — cero violaciones WCAG AA', async ({ page }) => {
  28 |     await login(page)
  29 |     await page.goto('/dashboard')
  30 |     await page.waitForLoadState('networkidle')
  31 | 
  32 |     const accessibilityScanResults = await new AxeBuilder({ page })
  33 |       .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
  34 |       .analyze()
  35 | 
  36 |     expect(accessibilityScanResults.violations).toEqual([])
  37 |   })
  38 | 
  39 |   test('emitir DTE — cero violaciones WCAG AA', async ({ page }) => {
  40 |     await login(page)
  41 |     await page.goto('/emit')
  42 |     await page.waitForLoadState('networkidle')
  43 | 
  44 |     const accessibilityScanResults = await new AxeBuilder({ page })
  45 |       .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
  46 |       .analyze()
  47 | 
  48 |     expect(accessibilityScanResults.violations).toEqual([])
  49 |   })
  50 | 
  51 |   test('remuneraciones — cero violaciones WCAG AA', async ({ page }) => {
  52 |     await login(page)
  53 |     await page.goto('/remuneraciones/trabajadores')
  54 |     await page.waitForLoadState('networkidle')
  55 | 
  56 |     const accessibilityScanResults = await new AxeBuilder({ page })
  57 |       .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
  58 |       .analyze()
  59 | 
  60 |     expect(accessibilityScanResults.violations).toEqual([])
  61 |   })
  62 | })
  63 | 
```