# Blog UX, Content & Landing Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five reported UX issues: broken /blog footer link on landing, developer jargon on landing, poor blog aesthetics, overly technical blog content, and perceived blog loading slowness.

**Architecture:** Four files to modify in dependency order. `lib/blog.ts` is the data layer — update first because blog pages import from it. `globals.css` adds two CSS utility classes needed by the article page. `app/(marketing)/page.tsx` gets targeted fixes. Both blog pages get full redesigns that consume the new data shape and CSS classes.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS v3, Fraunces (`var(--font-display)`), DM Sans (`var(--font-sans)`), Lucide React icons, existing editorial color tokens (`--primary`/oxblood, `--paper`, `--secondary`, `--ink`, `--border`)

---

### Task 1: Update `BlogPost` type and rewrite all 7 posts

**Files:**
- Modify: `apps/web/lib/blog.ts` (full rewrite)

- [ ] **Step 1: Replace the entire contents of `apps/web/lib/blog.ts`**

```ts
export type BlogPost = {
  slug: string
  title: string
  description: string
  date: string
  lastModified: string
  readTime: number
  category: string
  audience: "negocio" | "contador" | "ambos"
  excerpt: string
  content: string
}

export const blogPosts: BlogPost[] = [
  {
    slug: "como-emitir-dte-sii",
    title: "¿Cómo emitir una factura electrónica al SII sin que te la rechacen?",
    description: "Paso a paso para emitir documentos tributarios al SII desde tu empresa. Guía práctica para dueños de negocio y contadores.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 6,
    category: "Facturación",
    audience: "ambos",
    excerpt: "Emitir facturas al SII es obligatorio y más simple de lo que parece. Te explicamos los pasos y qué hacer si algo sale mal.",
    content: `<p class="drop-cap">Cada vez que vendes algo a otra empresa, estás obligado a emitir una factura electrónica. El Servicio de Impuestos Internos la recibe, la valida y la registra automáticamente. Si todo está correcto, el documento queda aceptado y tu cliente puede usar ese IVA como crédito fiscal.</p>
<blockquote class="pull-quote">Si te rechazan un documento, no entres en pánico: cada rechazo tiene un código que te dice exactamente qué corregir.</blockquote>
<h2>¿Qué necesitas antes de emitir?</h2>
<p>Para emitir legalmente necesitas tres cosas: que tu empresa esté registrada en el SII con actividad económica activa, un software autorizado para emitir documentos electrónicos (como ContaChile), y un certificado digital vigente. El certificado es el equivalente a tu firma física, pero en formato digital.</p>
<h2>Paso a paso: cómo emitir una factura</h2>
<p>Ingresa a la plataforma y crea un nuevo documento. Selecciona "Factura electrónica" si vendes a otra empresa con RUT, o "Boleta electrónica" si vendes a una persona. Completa los datos del receptor, los ítems y los montos. El sistema calcula el IVA automáticamente. Al confirmar, el documento se firma y se envía al SII. En menos de un minuto recibes la respuesta.</p>
<h2>¿Qué pasa si el SII rechaza la factura?</h2>
<p>Los rechazos tienen códigos de error específicos. Los más comunes son RUT incorrecto del receptor, monto de IVA que no cuadra, o datos del emisor desactualizados en el SII. ContaChile muestra el motivo del rechazo directamente en pantalla para que puedas corregirlo sin necesidad de llamar a soporte.</p>
<h2>¿Cuándo se usa boleta y cuándo factura?</h2>
<p>Si tu cliente es una persona que no va a pedir crédito fiscal, emite boleta. Si tu cliente es una empresa que sí va a recuperar el IVA, emite factura. En caso de duda, pregunta si necesitan factura con RUT de empresa.</p>`,
  },
  {
    slug: "que-es-f29-como-declarar",
    title: "F29: cómo declarar sin atrasos y qué hacer si ya te atrasaste",
    description: "Guía práctica para contadores que declaran el Formulario 29 mensual. Qué datos recopilar, cuándo presentarlo y qué pasa si no cumples.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 5,
    category: "Impuestos",
    audience: "contador",
    excerpt: "El F29 es la declaración mensual de IVA. Te explicamos qué datos necesitas, los plazos exactos y las multas por atraso.",
    content: `<p class="drop-cap">El Formulario 29 es la declaración mensual de impuestos que resume el IVA que cobró tu empresa (débito fiscal) menos el IVA que pagó en sus compras (crédito fiscal). Si el débito supera el crédito, la diferencia se paga al SII. Si el crédito supera el débito, se genera un remanente que puedes usar el mes siguiente.</p>
<blockquote class="pull-quote">El plazo para declarar el F29 vence el día 12 de cada mes. Si ese día cae sábado o feriado, el vencimiento se corre al día hábil siguiente.</blockquote>
<h2>¿Qué datos necesitas recopilar?</h2>
<p>Antes de declarar necesitas tener cuadrado tu registro de compras y ventas del mes. Eso significa revisar que todos los documentos emitidos y recibidos estén registrados correctamente. Desde 2017, el SII genera automáticamente este registro desde los documentos electrónicos. Aun así, es responsabilidad del contador revisar que no falte nada ni haya duplicados.</p>
<h2>¿Qué incluye el F29 además del IVA?</h2>
<p>El F29 también incluye el PPM (Pago Provisional Mensual, que es un anticipo del impuesto anual a la renta), las retenciones de honorarios si la empresa pagó boletas de honorarios a trabajadores independientes, y el impuesto único de segunda categoría si corresponde. Todo se declara en el mismo formulario.</p>
<h2>¿Qué pasa si no declaras a tiempo?</h2>
<p>El atraso genera intereses y multas que se calculan sobre el monto a pagar. La tasa de interés es de 1,5% mensual más un reajuste por IPC. Las multas van desde el 10% hasta el 60% del monto adeudado dependiendo del tiempo de atraso. Si ya estás atrasado, lo mejor es declarar y pagar cuanto antes para frenar el cálculo de intereses.</p>`,
  },
  {
    slug: "diferencia-boleta-factura-chile",
    title: "¿Boleta o factura? Cómo saber cuál emitir a tu cliente",
    description: "La diferencia entre boleta y factura electrónica en Chile. Cuándo pedir el RUT al cliente y qué documento corresponde en cada caso.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 4,
    category: "Facturación",
    audience: "negocio",
    excerpt: "Emitir el documento equivocado puede complicarte el IVA. Te explicamos con ejemplos simples cuándo usar cada uno.",
    content: `<p class="drop-cap">Si vendes servicios o productos, en algún momento un cliente te va a pedir factura. Y en otro momento vas a vender sin que te pidan nada. La diferencia importa porque cambia cómo se maneja el IVA para ambas partes.</p>
<blockquote class="pull-quote">La regla simple: si tu cliente es una empresa y necesita recuperar el IVA, emite factura. Si es una persona comprando para uso personal, emite boleta.</blockquote>
<h2>La diferencia en la práctica</h2>
<p>La boleta electrónica se emite a personas que compran para consumo propio. El IVA está incluido en el precio final y el comprador no puede recuperarlo. La factura electrónica se emite a empresas. El IVA aparece desglosado y el receptor puede usarlo como crédito fiscal en su propia declaración mensual de impuestos.</p>
<h2>¿Cuándo pedirle el RUT al cliente?</h2>
<p>Si el cliente dice "necesito factura", siempre pide su RUT de empresa (no el RUT personal). Verifica que el RUT corresponda a una empresa activa. Si el cliente no tiene RUT de empresa o no necesita factura, emite boleta directamente sin pedirle nada.</p>
<h2>¿Y si emito el documento equivocado?</h2>
<p>Si emitiste una boleta y el cliente necesitaba factura, puedes anular la boleta y emitir la factura correcta, siempre que sea dentro del mismo período tributario. Si ya cerró el período, necesitas emitir una nota de débito para corregir. Es trabajo evitable si consultas al cliente antes de emitir.</p>
<h2>Resumen rápido</h2>
<p>¿Tu cliente es una empresa y necesita recuperar IVA? Factura con RUT. ¿Tu cliente es una persona o no necesita recuperar IVA? Boleta. En caso de duda, pregunta: "¿Necesitas factura con RUT de empresa?"</p>`,
  },
  {
    slug: "iva-chile-como-calcular",
    title: "IVA en Chile: cuánto cobrar y cuándo pagarlo",
    description: "El IVA en Chile es del 19%. Te explicamos cómo incluirlo en tus precios, cuándo se paga al SII y cómo evitar sorpresas a fin de mes.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 4,
    category: "Impuestos",
    audience: "negocio",
    excerpt: "El IVA no es un gasto tuyo: es plata del Estado que tú cobras y guardas hasta el día 12 del mes siguiente.",
    content: `<p class="drop-cap">El IVA es el impuesto que cobras a tus clientes cada vez que vendes algo. No es dinero tuyo: lo estás recaudando en nombre del Estado. Al final de cada mes, calculas cuánto IVA cobraste y cuánto IVA pagaste en tus propias compras del negocio, y la diferencia se la pagas al SII antes del día 12 del mes siguiente.</p>
<blockquote class="pull-quote">El IVA que cobras a tus clientes no es ingreso tuyo. Es plata del fisco que tú administras temporalmente.</blockquote>
<h2>¿Cuánto IVA cobrar?</h2>
<p>El IVA en Chile es del 19% sobre el precio neto de tu servicio o producto. Si quieres cobrar $100.000 más IVA, el total que le cobras al cliente es $119.000. Si defines tu precio como precio final y quieres saber cuánto IVA incluye: divide $119.000 por 1,19 y obtienes $100.000 de precio neto más $19.000 de IVA.</p>
<h2>¿Puedo recuperar el IVA de mis compras?</h2>
<p>Sí. El IVA que pagas en tus compras del negocio (materiales, equipos, servicios) lo puedes descontar del IVA que debes pagar. Ejemplo: si cobraste $190.000 de IVA a tus clientes ese mes, pero pagaste $50.000 de IVA en compras del negocio, solo debes pagar $140.000 al SII. Para eso necesitas guardar todas tus facturas de proveedores.</p>
<h2>¿Cuándo se paga?</h2>
<p>El IVA se declara y paga junto con el F29, entre el 1° y el 12° de cada mes, por las ventas del mes anterior. Si el día 12 cae sábado, domingo o feriado, el plazo se extiende al siguiente día hábil. ContaChile calcula automáticamente el IVA a pagar a partir de los documentos que emitiste y recibiste.</p>`,
  },
  {
    slug: "certificacion-dte-sii",
    title: "Certificación tributaria electrónica: qué necesita tu empresa para emitir legalmente",
    description: "Qué significa estar certificado ante el SII para emitir documentos electrónicos, qué necesita una empresa y cuánto demora el proceso.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 7,
    category: "Facturación",
    audience: "contador",
    excerpt: "Sin certificación, tu empresa no puede emitir facturas electrónicas válidas. Te explicamos el proceso y cómo acortarlo.",
    content: `<p class="drop-cap">Para que una empresa pueda emitir facturas, boletas y demás documentos tributarios electrónicos en Chile, primero debe pasar por un proceso de certificación ante el SII. Este proceso valida que el sistema que va a usar cumple con los estándares técnicos y tributarios exigidos por el fisco.</p>
<blockquote class="pull-quote">Una empresa que no está certificada no puede emitir documentos electrónicos válidos por cuenta propia. Puede usar un proveedor de servicios autorizado mientras gestiona la certificación propia.</blockquote>
<h2>¿Qué significa estar certificado?</h2>
<p>Significa que el SII validó que el sistema puede generar, firmar y enviar documentos tributarios correctamente. La certificación no es de la empresa como tal, sino del sistema emisor que usa. Plataformas como ContaChile ya tienen esta certificación, por lo que tus clientes pueden emitir desde el día uno sin esperar ningún proceso adicional.</p>
<h2>¿Cuándo necesita la empresa certificación propia?</h2>
<p>Si la empresa quiere integrarse directamente con el SII desde su propio sistema interno o ERP, entonces sí necesita certificación propia. El proceso implica enviar juegos de prueba al ambiente de certificación del SII y esperar resolución. El tiempo estimado oscila entre 30 y 120 días hábiles.</p>
<h2>La alternativa mientras esperas</h2>
<p>Mientras se gestiona la certificación propia, las empresas pueden operar a través de un proveedor autorizado de servicios de emisión electrónica. Este proveedor actúa como intermediario: recibe los datos de la empresa y emite los documentos ante el SII en su nombre.</p>
<h2>¿Qué necesita el contador para gestionar esto?</h2>
<p>El contador debe verificar que la empresa tiene actividad económica activa en el SII, que tiene un certificado digital vigente, y que el sistema que va a usar tiene la certificación correspondiente. ContaChile simplifica todo esto: la empresa se registra, configura sus datos y puede emitir el mismo día.</p>`,
  },
  {
    slug: "libro-compras-ventas-chile",
    title: "Libro de compras y ventas: para qué sirve y los errores que debes evitar",
    description: "El registro de compras y ventas es la base del F29. Aprende qué registra, cómo se genera y los errores más comunes que complican la declaración mensual.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 5,
    category: "Contabilidad",
    audience: "contador",
    excerpt: "El registro de compras y ventas se genera automáticamente desde tus documentos electrónicos. Pero hay errores que siguen ocurriendo.",
    content: `<p class="drop-cap">El libro de compras y ventas registra todos los documentos tributarios que una empresa emitió y recibió durante un período determinado. Es la base sobre la cual se calcula el IVA del mes y se completa el F29. Desde 2017, el SII genera automáticamente el Registro de Compras y Ventas a partir de los documentos electrónicos registrados en su sistema.</p>
<blockquote class="pull-quote">Que el SII genere el registro automáticamente no significa que sea responsabilidad del SII. El contador debe revisar que todos los documentos estén correctamente registrados.</blockquote>
<h2>¿Para qué sirve exactamente?</h2>
<p>Sirve para determinar el débito fiscal (IVA de las ventas) y el crédito fiscal (IVA de las compras) del período. La diferencia entre ambos es lo que la empresa debe pagar o puede remantar al mes siguiente. También es el registro que el SII puede auditar si tiene dudas sobre la declaración de la empresa.</p>
<h2>¿Quién está obligado a llevarlo?</h2>
<p>Toda empresa o persona natural con giro afecta a IVA. Es decir, cualquier negocio que venda bienes o preste servicios gravados con IVA. Los profesionales que emiten solo boletas de honorarios no están afectos a IVA y no llevan este registro.</p>
<h2>Errores comunes que complican el F29</h2>
<p>El error más frecuente es confiar en el registro automático sin revisarlo. Pueden faltar documentos de proveedores que no emiten electrónicamente, o aparecer documentos duplicados si el sistema interno también los registra. Otro error habitual es no revisar las notas de crédito: si un proveedor anuló una factura pero no emitió la nota de crédito correspondiente, el crédito fiscal aparece pero el documento ya no es válido.</p>
<h2>¿Cuándo se debe cuadrar?</h2>
<p>El registro se cierra automáticamente al finalizar el período tributario. No se presenta por separado: es la base del F29 que sí se declara mensualmente. Lo importante es tenerlo cuadrado antes del día 12 de cada mes.</p>`,
  },
  {
    slug: "ppm-chile-que-es",
    title: "PPM: el descuento mensual que adelanta tu impuesto anual",
    description: "Los Pagos Provisionales Mensuales son anticipos del impuesto a la renta. Aprende qué son, cuánto se paga y cómo se relacionan con tu declaración anual.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 5,
    category: "Impuestos",
    audience: "negocio",
    excerpt: "El PPM es plata que pagas cada mes y que luego descuentas de tu impuesto anual. Si pagas de más, te devuelven la diferencia.",
    content: `<p class="drop-cap">Cada mes, junto con el IVA, las empresas chilenas pagan un porcentaje de sus ingresos que funciona como adelanto del impuesto a la renta de fin de año. A eso se le llama PPM, Pago Provisional Mensual. La lógica es simple: en vez de esperar a abril para pagar un impuesto enorme, el fisco te hace pagarlo en cuotas mes a mes durante el año.</p>
<blockquote class="pull-quote">El PPM no es un impuesto adicional: es un anticipo de lo que ya deberías pagar en abril. Si pagaste más de lo que corresponde, el SII te devuelve la diferencia.</blockquote>
<h2>¿Quién paga PPM?</h2>
<p>Todas las empresas que tributan en primera categoría: sociedades anónimas, SpA, EIRL, sociedades de responsabilidad limitada. También pagan PPM los profesionales independientes que emiten boletas de honorarios, aunque con un mecanismo distinto. Si tienes una empresa con cualquiera de estas formas jurídicas, estás pagando PPM cada mes.</p>
<h2>¿Cuánto se paga?</h2>
<p>El porcentaje del PPM lo fija el SII cada año y depende del resultado del año anterior. Si tu empresa tuvo impuesto a pagar el año pasado, el PPM sube un poco. Si tuvo pérdidas, baja. La tasa típica está entre el 2% y el 5% de los ingresos brutos del mes. ContaChile calcula el monto automáticamente y lo incluye en el F29 mensual.</p>
<h2>¿Qué pasa en abril?</h2>
<p>En abril presentas la declaración anual de renta (F22). Ahí calculas el impuesto total que corresponde pagar por el año anterior. A ese monto le descuentas todo lo que ya pagaste mes a mes como PPM durante el año. Si pagaste más en PPM de lo que debes en impuesto anual, el SII te devuelve la diferencia. Si pagaste menos, pagas la diferencia.</p>
<h2>¿Puedo pagar menos PPM?</h2>
<p>Sí. Si tu empresa está en período de inicio de actividades o tuvo pérdidas significativas, puedes solicitar reducción del PPM ante el SII. Habla con tu contador para evaluar qué conviene en tu caso.</p>`,
  },
]

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug)
}

export function getAllSlugs(): string[] {
  return blogPosts.map((p) => p.slug)
}
```

- [ ] **Step 2: Verify TypeScript compiles (no new type errors)**

Run from the monorepo root:
```bash
pnpm --filter web tsc --noEmit
```
Expected: no errors. If errors appear they will be in blog pages that reference `post.audience` — they don't exist yet, so ignore for now. Any other errors need fixing.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/blog.ts
git commit -m "feat(blog): rewrite content for business/accountant audiences, add audience field"
```

---

### Task 2: Add `.drop-cap` and `.pull-quote` CSS utility classes

**Files:**
- Modify: `apps/web/app/globals.css` (append to `@layer components`)

- [ ] **Step 1: Append the following block to the end of the `@layer components { }` block in `globals.css`** (before the closing `}` of the `@layer components` block, after `.table-editorial`):

```css
  /* Blog article: drop cap on first paragraph */
  .prose .drop-cap::first-letter,
  .drop-cap::first-letter {
    font-family: var(--font-display);
    font-size: 3.5rem;
    font-weight: 900;
    float: left;
    line-height: 0.82;
    margin-right: 0.12em;
    margin-top: 0.06em;
    color: hsl(var(--primary));
  }

  /* Blog article: editorial pull quote */
  .prose .pull-quote,
  .pull-quote {
    border-left: 3px solid hsl(var(--primary));
    padding: 0.75rem 1.25rem;
    margin: 1.75rem 0;
    font-size: 1.0625rem;
    font-style: italic;
    color: hsl(var(--ink));
    background: hsl(var(--secondary) / 0.4);
    border-radius: 0;
    quotes: none;
  }
  .prose .pull-quote::before,
  .prose .pull-quote::after,
  .pull-quote::before,
  .pull-quote::after {
    content: none;
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat(blog): add drop-cap and pull-quote CSS utility classes"
```

---

### Task 3: Fix landing page — broken /blog link and jargon removal

**Files:**
- Modify: `apps/web/app/(marketing)/page.tsx`

There are three targeted changes.

**Change A — fix broken Blog footer link (line ~534)**

Find this block in the `Empresa` footer column:
```tsx
<li>
  <span className="hover:text-foreground cursor-pointer transition-colors">
    Blog
  </span>
</li>
```
Replace with:
```tsx
<li>
  <Link href="/blog" className="hover:text-foreground transition-colors">
    Blog
  </Link>
</li>
```

**Change B — rewrite "HOW IT WORKS" section heading and step descriptions (lines ~331–354)**

Find and replace the section H2:
```tsx
Del formulario al{" "}
<em className="text-primary not-italic font-medium">
  XML firmado
</em>{" "}
en segundos.
```
Replace with:
```tsx
Del formulario al{" "}
<em className="text-primary not-italic font-medium">
  SII
</em>{" "}
en segundos.
```

Find and replace the `steps` array inside `HomePage` (the inline array starting at `.map((item, i) =>`). Replace the three step objects with:
```tsx
{[
  {
    step: "01",
    title: "Completa",
    desc: "Ingresa receptor, ítems y forma de pago. Calculamos el IVA automáticamente y validamos el RUT.",
  },
  {
    step: "02",
    title: "Firma",
    desc: "Firmamos el documento con tu certificado digital. El proceso completo tarda menos de un segundo.",
  },
  {
    step: "03",
    title: "Distribuye",
    desc: "Enviamos el documento al SII y notificamos a tu cliente por email cuando es aceptado.",
  },
].map((item, i) => (
```

**Change C — remove "tool-use" jargon from Enterprise pricing plan**

In the `pricing` array, find the Enterprise plan feature:
```tsx
"Agentes IA con tool-use",
```
Replace with:
```tsx
"Agentes IA avanzados",
```

- [ ] **Step 1: Apply Change A — fix broken Blog footer link**

- [ ] **Step 2: Apply Change B — rewrite HOW IT WORKS heading and step descriptions**

- [ ] **Step 3: Apply Change C — remove "tool-use" from Enterprise plan**

- [ ] **Step 4: Verify the landing page in the dev server**

```bash
pnpm --filter web dev
```

Open `http://localhost:3000`. Verify:
- "Blog" link in footer navigates to `/blog`
- "Cómo funciona" section shows no developer jargon (no XML, xmldsig, BullMQ, módulo 11)
- Enterprise plan shows "Agentes IA avanzados"

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(marketing)/page.tsx
git commit -m "fix(landing): fix broken /blog link, remove developer jargon from how-it-works section"
```

---

### Task 4: Redesign blog index page with editorial aesthetic

**Files:**
- Modify: `apps/web/app/(marketing)/blog/page.tsx` (full rewrite)

This task depends on Task 1 (uses `post.audience`).

The audience badge helper is defined locally inside the component file — no shared component needed.

- [ ] **Step 1: Replace the entire contents of `apps/web/app/(marketing)/blog/page.tsx`**

```tsx
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import { ArrowRight } from "lucide-react"
import { blogPosts } from "@/lib/blog"
import type { BlogPost } from "@/lib/blog"

export const metadata = {
  title: "Blog — Contabilidad y Tributación en Chile",
  description: "Guías prácticas sobre facturación electrónica, F29, IVA y contabilidad para pymes chilenas.",
  alternates: { canonical: "/blog" },
}

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Inicio", item: "https://contachile.cl" },
    { "@type": "ListItem", position: 2, name: "Blog",   item: "https://contachile.cl/blog" },
  ],
}

function AudienceBadge({ audience }: { audience: BlogPost["audience"] }) {
  const config = {
    negocio:  { label: "Para mi negocio",        className: "bg-blue-100 text-blue-700" },
    contador: { label: "Para contadores",         className: "bg-purple-100 text-purple-700" },
    ambos:    { label: "Empresas & Contadores",   className: "bg-green-100 text-green-700" },
  }
  const { label, className } = config[audience]
  return (
    <span className={`inline-block text-[0.6rem] font-semibold uppercase tracking-wide px-2 py-0.5 ${className}`}>
      {label}
    </span>
  )
}

export default function BlogIndexPage() {
  const [featured, ...rest] = blogPosts

  return (
    <>
      <JsonLd data={breadcrumbSchema} />

      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-border bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
          <div className="container flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative h-9 w-9 border border-foreground bg-paper flex items-center justify-center">
                <span className="font-display text-base font-black leading-none text-foreground">C</span>
                <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 bg-primary" />
              </div>
              <div className="leading-none">
                <span className="block font-display text-lg font-semibold tracking-tightest">ContaChile</span>
                <span className="block eyebrow !text-[0.55rem] !tracking-[0.2em] mt-0.5 text-muted-foreground/70">Edición Financiera</span>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/features" className="eyebrow hover:text-foreground transition-colors">Características</Link>
              <Link href="/precios" className="eyebrow hover:text-foreground transition-colors">Precios</Link>
              <Link href="/login"><Button variant="ghost">Iniciar sesión</Button></Link>
              <Link href="/sign-up"><Button>Probar gratis</Button></Link>
            </nav>
          </div>
        </header>

        {/* Newspaper masthead */}
        <div className="border-b bg-paper" style={{ borderBottomWidth: "3px", borderBottomStyle: "double" }}>
          <div className="container py-6 text-center">
            <h1 className="font-display text-4xl md:text-5xl font-black tracking-tightest text-foreground">
              ContaChile · Blog
            </h1>
            <p className="eyebrow mt-1 text-muted-foreground/70">
              Guías tributarias para empresas y contadores
            </p>
            {/* Decorative category nav — not interactive, all posts always shown */}
            <div className="flex justify-center gap-5 mt-4 flex-wrap">
              {["Todo", "Facturación", "IVA & Impuestos", "Formularios SII", "Para mi negocio", "Para contadores"].map((tab, i) => (
                <span
                  key={tab}
                  className={`text-[0.7rem] font-semibold uppercase tracking-widest pb-0.5 ${
                    i === 0
                      ? "text-foreground border-b-2 border-foreground"
                      : "text-muted-foreground/60"
                  }`}
                >
                  {tab}
                </span>
              ))}
            </div>
          </div>
        </div>

        <main className="flex-1">
          <div className="container py-10">

            {/* Featured article */}
            <div className="eyebrow mb-4 text-muted-foreground/70">Artículo destacado</div>
            <Link
              href={`/blog/${featured.slug}`}
              className="group grid md:grid-cols-[3fr_2fr] border border-border overflow-hidden mb-10 hover:bg-secondary/20 transition-colors"
            >
              {/* Color block */}
              <div className="relative min-h-[180px] bg-gradient-to-br from-foreground/90 to-primary flex flex-col justify-end p-8">
                <span className="eyebrow text-white/60 mb-2">{featured.category} · {featured.readTime} min</span>
                <p className="font-display text-xl md:text-2xl font-bold text-white leading-snug tracking-tightest">
                  {featured.title}
                </p>
              </div>
              {/* Content */}
              <div className="p-8 flex flex-col justify-between bg-paper">
                <div>
                  <span className="eyebrow text-primary/80 block mb-2">{featured.category} · {featured.readTime} min</span>
                  <p className="font-display text-xl font-semibold tracking-tightest mb-3 group-hover:text-primary transition-colors leading-snug">
                    {featured.title}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {featured.excerpt}
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-3 flex-wrap">
                  <AudienceBadge audience={featured.audience} />
                  <span className="text-xs text-muted-foreground/60 font-mono ml-auto flex items-center gap-1">
                    Leer artículo <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            </Link>

            {/* Section divider */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-border" />
              <span className="eyebrow text-muted-foreground/50">Últimos artículos</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Post grid */}
            <div className="grid gap-px bg-border border border-border md:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="bg-paper p-7 group hover:bg-secondary/40 transition-colors flex flex-col gap-4"
                >
                  <div>
                    <span className="eyebrow text-primary/70">{post.category} · {post.readTime} min</span>
                    <h2 className="font-display text-lg font-semibold tracking-tightest mt-1.5 mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {post.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {post.excerpt}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                    <AudienceBadge audience={post.audience} />
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>

          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-8 bg-secondary/30">
          <div className="container flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground/70 font-mono">
            <p>© {new Date().getFullYear()} ContaChile · Todos los derechos reservados</p>
            <Link href="/" className="mt-2 md:mt-0 hover:text-foreground transition-colors">contachile.cl</Link>
          </div>
        </footer>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify blog index in dev server**

With `pnpm --filter web dev` running, open `http://localhost:3000/blog`. Verify:
- Newspaper masthead with double border appears at top
- First post appears as featured article with gradient color block on left
- Remaining 6 posts appear in 3-column grid with audience badges
- Each badge color matches audience: blue=negocio, purple=contador, green=ambos

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(marketing)/blog/page.tsx
git commit -m "feat(blog): editorial newspaper redesign — masthead, featured post, audience badges"
```

---

### Task 5: Redesign blog article page with editorial aesthetic

**Files:**
- Modify: `apps/web/app/(marketing)/blog/[slug]/page.tsx`

This task depends on Task 1 (uses `post.audience`) and Task 2 (CSS classes render inside article body HTML).

The article page keeps all existing logic (schemas, generateMetadata, generateStaticParams, prev/next, CTA). Only the visual structure of the article header and body wrapper changes. The HTML content rendering is preserved as-is.

- [ ] **Step 1: Replace the `AudienceBadge` helper and article `<header>` section inside `<article>`**

Add the `AudienceBadge` function at the top of the file (after imports, before `generateMetadata`):

```tsx
function AudienceBadge({ audience }: { audience: "negocio" | "contador" | "ambos" }) {
  const config = {
    negocio:  { label: "Para mi negocio",        className: "bg-blue-100 text-blue-700" },
    contador: { label: "Para contadores",         className: "bg-purple-100 text-purple-700" },
    ambos:    { label: "Empresas & Contadores",   className: "bg-green-100 text-green-700" },
  }
  const { label, className } = config[audience]
  return (
    <span className={`inline-block text-[0.6rem] font-semibold uppercase tracking-wide px-2 py-0.5 ${className}`}>
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Replace the article `<header>` section (inside `<article>`)**

Find the current article header block (starts with `{/* Article header */}` and ends before the article body comment). Replace it with:

```tsx
{/* Article header */}
<header className="border-b-2 border-foreground py-14">
  <div className="container max-w-3xl">
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      <span className="eyebrow text-primary/80">{post.category}</span>
      <span className="h-px w-6 bg-border" />
      <span className="text-xs text-muted-foreground font-mono">{post.readTime} min de lectura</span>
      <span className="h-px w-6 bg-border" />
      <time className="text-xs text-muted-foreground font-mono" dateTime={post.date}>
        {new Date(post.date).toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" })}
      </time>
    </div>
    <h1 className="font-display text-4xl md:text-5xl font-black tracking-tightest leading-tight mb-5">
      {post.title}
    </h1>
    <p className="text-lg italic text-muted-foreground leading-relaxed mb-6 max-w-2xl border-l-2 border-border pl-4">
      {post.description}
    </p>
    <div className="flex items-center gap-3 flex-wrap">
      <AudienceBadge audience={post.audience} />
      <span className="text-xs text-muted-foreground/60 font-mono">ContaChile · {new Date(post.date).getFullYear()}</span>
    </div>
  </div>
</header>
```

- [ ] **Step 3: Update article body container className**

Find the container `<div>` that wraps the HTML content (the one with `prose` classes and the HTML injection). Replace its `className` with:

```tsx
className="container max-w-3xl prose prose-slate max-w-none
  prose-headings:font-display prose-headings:tracking-tightest prose-headings:text-foreground
  prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:font-bold
  prose-h3:text-xl prose-h3:mt-8
  prose-p:text-base prose-p:leading-[1.85] prose-p:text-foreground/80
  prose-strong:text-foreground prose-strong:font-semibold"
```

(Keep the HTML content rendering attribute exactly as it is in the existing file — do not change it.)

- [ ] **Step 4: Verify article page in dev server**

Open any blog post at `http://localhost:3000/blog/como-emitir-dte-sii`. Verify:
- Article header shows audience badge (green "Empresas & Contadores"), eyebrow, bold H1, italic deck
- First paragraph has drop cap: large first letter in primary color (burgundy), floated left
- Pull quote appears as styled blockquote with left border
- Section H2s are large and readable

- [ ] **Step 5: Verify font loading is non-blocking**

Open `apps/web/app/layout.tsx`. Confirm both `Fraunces` and `DM_Sans` are configured with `display: "swap"`. They should already be — no change needed. If for any reason they are not, add `display: "swap"` to both font configurations. This prevents fonts from blocking the initial render.

- [ ] **Step 6: Verify build produces static routes**

```bash
pnpm --filter web build
```

In the build output, look for the blog routes. They must show as `○` (Static), not `λ` (Dynamic):
```
○ /blog
○ /blog/como-emitir-dte-sii
○ /blog/que-es-f29-como-declarar
...
```
If any blog route shows as `λ`, check for accidental `export const dynamic = "force-dynamic"` in the file.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/(marketing)/blog/[slug]/page.tsx
git commit -m "feat(blog): editorial article layout — drop cap, pull quotes, audience badge, improved typography"
```
