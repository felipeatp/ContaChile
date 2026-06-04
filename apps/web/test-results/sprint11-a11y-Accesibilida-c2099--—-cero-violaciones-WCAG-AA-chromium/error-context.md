# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sprint11-a11y.spec.ts >> Accesibilidad WCAG AA — Sprint 11 >> login — cero violaciones WCAG AA
- Location: e2e\sprint11-a11y.spec.ts:16:7

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 70

- Array []
+ Array [
+   Object {
+     "description": "Ensure links are distinguished from surrounding text in a way that does not rely on color",
+     "help": "Links must be distinguishable without relying on color",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/link-in-text-block?application=playwright",
+     "id": "link-in-text-block",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "contrastRatio": 2.67,
+               "messageKey": "fgContrast",
+               "nodeColor": "#241d19",
+               "parentColor": "#695f59",
+               "requiredContrastRatio": 3,
+             },
+             "id": "link-in-text-block",
+             "impact": "serious",
+             "message": "The link has insufficient color contrast of 2.67:1 with the surrounding text. (Minimum contrast is 3:1, link text: #241d19, surrounding text: #695f59)",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<p class=\"text-center text-xs text-muted-foreground\">¿No tienes cuenta?<!-- --> <a class=\"text-foreground hover:underline\" href=\"/sign-up\">Regístrate</a></p>",
+                 "target": Array [
+                   ".text-center:nth-child(5)",
+                 ],
+               },
+             ],
+           },
+           Object {
+             "data": null,
+             "id": "link-in-text-block-style",
+             "impact": "serious",
+             "message": "The link has no styling (such as underline) to distinguish it from the surrounding text",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<p class=\"text-center text-xs text-muted-foreground\">¿No tienes cuenta?<!-- --> <a class=\"text-foreground hover:underline\" href=\"/sign-up\">Regístrate</a></p>",
+                 "target": Array [
+                   ".text-center:nth-child(5)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   The link has insufficient color contrast of 2.67:1 with the surrounding text. (Minimum contrast is 3:1, link text: #241d19, surrounding text: #695f59)
+   The link has no styling (such as underline) to distinguish it from the surrounding text",
+         "html": "<a class=\"text-foreground hover:underline\" href=\"/sign-up\">Regístrate</a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "a",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2a",
+       "wcag141",
+       "TTv5",
+       "TT13.a",
+       "EN-301-549",
+       "EN-9.1.4.1",
+       "RGAAv4",
+       "RGAA-10.6.1",
+     ],
+   },
+ ]
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
      - generic [ref=e12]:
        - generic [ref=e13]:
          - text: Email
          - textbox "Email" [ref=e14]:
            - /placeholder: tu@email.com
        - generic [ref=e15]:
          - text: Contraseña
          - textbox "Contraseña" [ref=e16]:
            - /placeholder: ••••••••
        - button "Iniciar sesión" [ref=e17] [cursor=pointer]
      - generic [ref=e22]: O
      - generic [ref=e23]:
        - button "Continuar con Google" [ref=e24] [cursor=pointer]:
          - img [ref=e25]
          - text: Continuar con Google
        - button "Continuar con Microsoft" [ref=e30] [cursor=pointer]:
          - img [ref=e31]
          - text: Continuar con Microsoft
      - paragraph [ref=e36]:
        - text: ¿No tienes cuenta?
        - link "Regístrate" [ref=e37] [cursor=pointer]:
          - /url: /sign-up
  - button "Open Next.js Dev Tools" [ref=e43] [cursor=pointer]:
    - img [ref=e44]
  - alert [ref=e47]
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
  12 |   await page.waitForURL(/\/dashboard/, { timeout: 10_000 })
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
> 24 |     expect(accessibilityScanResults.violations).toEqual([])
     |                                                 ^ Error: expect(received).toEqual(expected) // deep equality
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