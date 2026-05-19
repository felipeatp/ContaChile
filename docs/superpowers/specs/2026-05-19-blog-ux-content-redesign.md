# Spec: Blog UX, Content & Landing Fixes

**Date:** 2026-05-19
**Scope:** `apps/web`

---

## Context

After launching Phase 1–5 of the SEO plan, five UX/content issues were reported:
1. Blog loads slowly (perceived)
2. Blog aesthetics are poor — no visual hierarchy
3. Landing page has developer jargon that clients don't understand
4. `/blog` buttons in the landing footer are broken (non-functional span element)
5. Blog content is too technical — needs language for businesses and accountants

---

## Group 1: Quick Fixes

### 1a — Fix broken /blog link in landing

**File:** `apps/web/app/(marketing)/page.tsx`

The footer renders `<span>Blog</span>` with no href or Link component. Replace with `<Link href="/blog">Blog</Link>`. Also audit any other blog buttons/links in the hero, nav, or CTA sections of the same file that may be broken.

**Acceptance:** Clicking "Blog" anywhere on the landing navigates to `/blog`.

### 1b — Remove technical jargon from landing

**File:** `apps/web/app/(marketing)/page.tsx`

Remove or simplify all developer/infrastructure-level language from the landing. Specifically remove:
- Any mention of: `XML`, `ISO-8859-1`, `xmldsig`, `EnvioDTE`, `BullMQ`, `módulo 11`, `pipeline DTE`
- Full blocks that describe internal implementation details instead of user benefits

Replace with benefit-oriented language or remove entirely. The landing should only communicate **what ContaChile does for the user**, not how it is built internally.

**Rule:** If a non-technical business owner would not understand a phrase, remove it.

**Acceptance:** No developer acronyms or internal architecture terms visible on the landing page.

---

## Group 2: Blog Aesthetic Redesign — Editorial/Newspaper Style

**Files:**
- `apps/web/app/(marketing)/blog/page.tsx`
- `apps/web/app/(marketing)/blog/[slug]/page.tsx`
- `apps/web/app/globals.css` — add `.drop-cap::first-letter` and `.pull-quote` utility classes used in article body

### Blog index (`/blog`)

**Header:**
- Masthead: "ContaChile · Blog" in `font-display` (Fraunces), bold, large
- Tagline: "Guías tributarias para empresas y contadores" — small uppercase
- Category nav tabs: Todo | Facturación | IVA & Impuestos | Formularios SII | Para mi negocio | Para contadores — **decorative only** (no JS filtering; all posts always shown). Adding client-side filtering would require `"use client"` and break static generation.
- Bottom border: `3px double` to reinforce newspaper feel
- Background: `bg-paper` (`#f5f2ed` or existing `--color-paper` token)

**Featured article (first post):**
- Full-width 2-column layout: left = image/color block with title overlaid, right = eyebrow + title + excerpt + badges
- `grid-template-columns: 3fr 2fr`
- Color block uses a blue gradient (brand color)
- Border: `1px solid` with muted border color

**Post grid (remaining posts):**
- 3-column grid separated by `1px` hairlines (grid gap = 1px, background = border color)
- Each card: eyebrow (category + read time), title in serif, excerpt in sans-serif, audience badge
- No rounded corners — flat newspaper card style

**Audience badges** (required on every card and article):
- `Para mi negocio` → blue (`bg-blue-100 text-blue-700`)
- `Para contadores` → purple (`bg-purple-100 text-purple-700`)
- `Empresas & Contadores` → green (`bg-green-100 text-green-700`)

**Section divider between featured and grid:**
- Horizontal rule with centered label: `── ÚLTIMOS ARTÍCULOS ──`
- Style: small uppercase, letter-spacing, flanked by `1px` lines

### Article detail page (`/blog/[slug]`)

**Article header:**
- Eyebrow: category + read time
- H1: large, Fraunces, font-weight 900
- Deck/bajada: italic, slightly smaller, summarizes the article
- Audience badge + byline (ContaChile · date)
- Bottom border: `2px solid #111` separating header from body

**Article body:**
- Drop cap on first paragraph: first letter large (48px), Fraunces, brand blue
- Pull quotes: left border `3px solid` brand blue, light blue background, italic text
- Section headings: `h2` and `h3` in serif, bold
- Body text: readable size (15-16px), line-height 1.8, serif font
- Background: white card on paper background

**CTA at end of article:**
- Box with border, "Emite tus documentos tributarios con ContaChile" + primary button

---

## Group 3: Blog Content Rewrite

**File:** `apps/web/lib/blog.ts`

All 7 posts are rewritten. The existing `content` field in each `BlogPost` object is replaced.

### Content rules (apply to all posts)

- **No technical jargon**: No XML, ISO encoding names, digital signature protocol names, RUT algorithm details, API references, database terms
- **No developer perspective**: Write as a business advisor, not a developer
- **Tone**: Direct, practical, warm. Like explaining to a business owner who is smart but not an accountant.
- **Audience-specific**: Each post targets one audience; tone adjusts accordingly
  - `Para mi negocio`: simpler, more reassuring, focus on "what do I need to do"
  - `Para contadores`: more precise on process, assumes knowledge of tax terms (IVA, PPM, F29) but not software
- **Structure per post** (reflected in the `content` HTML string):
  - Opening paragraph with drop-cap class (`<p class="drop-cap">`)
  - 1–2 pull quotes (`<blockquote class="pull-quote">`)
  - Clear `<h2>` section headers
  - Practical steps or examples
  - Closing paragraph with natural CTA mention

### Post rewrites

| slug | audience | new angle |
|------|----------|-----------|
| `como-emitir-dte-sii` | Ambos | What a DTE is in plain terms, concrete steps, what happens on rejection |
| `que-es-f29-como-declarar` | Para contadores | How not to miss the deadline, what data to gather, penalties for late filing |
| `diferencia-boleta-factura-chile` | Para mi negocio | When to ask the client for RUT, which document to issue in each situation |
| `iva-chile-como-calcular` | Para mi negocio | How much to charge, when to pay, no formulas — just examples with real amounts |
| `certificacion-dte-sii` | Para contadores | What "certified" means, what a company needs, how to manage it |
| `libro-compras-ventas-chile` | Para contadores | What it's for, when it's due, common mistakes |
| `ppm-chile-que-es` | Para mi negocio | What gets deducted, when it's paid, how it relates to the F29 |

The `BlogPost` type gains one new field:
```ts
audience: "negocio" | "contador" | "ambos"
```
This field drives the badge color in the UI.

---

## Group 4: Performance

**Files:**
- `apps/web/app/(marketing)/blog/page.tsx`
- `apps/web/app/(marketing)/blog/[slug]/page.tsx`

**Checks and fixes:**

1. **Verify no `dynamic = "force-dynamic"`** on blog routes — they must be statically generated at build time via `generateStaticParams`.

2. **Verify font loading**: `Fraunces` and `DM_Sans` already use `display: "swap"` in `app/layout.tsx` — confirm no additional font imports on blog pages that would block rendering.

3. **Content rendering**: The article body is rendered via inner HTML injection from static content. For long posts this is fine — the static HTML is small. No lazy loading needed.

4. **OG image edge runtime**: The `/blog/[slug]/opengraph-image.tsx` uses `runtime = "edge"` — correct, only affects social crawlers. No change needed.

**Acceptance:** Running `next build` shows all `/blog` and `/blog/[slug]` routes as `○ Static`.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `apps/web/app/(marketing)/page.tsx` | Fix broken blog link(s), remove jargon blocks |
| `apps/web/app/(marketing)/blog/page.tsx` | Full redesign — editorial masthead, featured post, grid |
| `apps/web/app/(marketing)/blog/[slug]/page.tsx` | Full redesign — drop cap, pull quotes, deck |
| `apps/web/lib/blog.ts` | Add `audience` field, rewrite all 7 post contents |

---

## Out of Scope

- Adding real images or photos to blog posts (no image hosting set up)
- Pagination or search for the blog index
- Comments or social sharing buttons
- Changing the blog URL structure
