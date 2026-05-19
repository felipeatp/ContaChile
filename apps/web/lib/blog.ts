export type BlogPost = {
  slug: string
  title: string
  description: string
  date: string        // ISO date string: "2026-05-19"
  lastModified: string
  readTime: number    // minutes
  category: string
  excerpt: string     // 1-2 sentence preview
  content: string     // HTML string (stub content for now)
}

export const blogPosts: BlogPost[] = [
  {
    slug: "como-emitir-dte-sii",
    title: "Cómo emitir un DTE en el SII: guía paso a paso",
    description: "Aprende a emitir documentos tributarios electrónicos (DTE) en el SII. Desde la obtención del certificado hasta el envío y acuse de recibo.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 8,
    category: "Facturación",
    excerpt: "Todo lo que necesitas saber para emitir tu primer DTE: certificado digital, tipos de documento y proceso de envío al SII.",
    content: `<p>La emisión de documentos tributarios electrónicos (DTE) es obligatoria para la mayoría de las empresas chilenas. En este artículo explicamos el proceso completo.</p>
<h2>¿Qué es un DTE?</h2>
<p>Un DTE es un documento tributario emitido en formato electrónico XML, firmado digitalmente y enviado al SII para validación. Los tipos más comunes son la factura electrónica (tipo 33) y la boleta electrónica (tipo 39).</p>
<h2>Pasos para emitir un DTE</h2>
<p>1. Obtén tu certificado digital ante una entidad acreditada. 2. Regístrate como emisor electrónico en el SII. 3. Certifícate enviando juegos de prueba al servidor maullin.sii.cl. 4. Una vez certificado, emite documentos al servidor productivo api.sii.cl.</p>`,
  },
  {
    slug: "que-es-f29-como-declarar",
    title: "Qué es el F29 y cómo declararlo correctamente",
    description: "El formulario F29 es la declaración mensual de IVA en Chile. Aprende qué incluye, cuándo se declara y cómo calcular el monto a pagar.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 6,
    category: "Impuestos",
    excerpt: "El F29 se declara mensualmente ante el SII. Te explicamos qué es el débito fiscal, el crédito fiscal y cómo calcular el IVA a pagar.",
    content: `<p>El Formulario 29 (F29) es la declaración mensual de impuestos que deben presentar las empresas chilenas ante el SII.</p>
<h2>¿Qué incluye el F29?</h2>
<p>El F29 incluye el IVA (débito menos crédito fiscal), el PPM (Pagos Provisionales Mensuales), retenciones y otros impuestos de declaración mensual.</p>
<h2>¿Cuándo se declara?</h2>
<p>El F29 debe declararse entre el 1° y el 12° día hábil del mes siguiente al período tributario correspondiente.</p>`,
  },
  {
    slug: "diferencia-boleta-factura-chile",
    title: "Diferencia entre boleta y factura electrónica en Chile",
    description: "¿Cuándo usar boleta y cuándo factura? Diferencias clave entre ambos documentos tributarios en Chile, sus usos y obligaciones.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 5,
    category: "Facturación",
    excerpt: "La boleta se usa para ventas a consumidores finales; la factura, para ventas a empresas. Cada uno tiene implicancias tributarias distintas.",
    content: `<p>La diferencia principal entre boleta y factura electrónica tiene que ver con quién es el receptor del documento y sus implicancias en el IVA.</p>
<h2>Boleta electrónica (Tipo 39)</h2>
<p>Se emite a consumidores finales (personas naturales sin giro). El IVA está incluido en el precio. El receptor no puede usar el documento como crédito fiscal.</p>
<h2>Factura electrónica (Tipo 33)</h2>
<p>Se emite a empresas con giro comercial. El IVA se desglosal. El receptor puede usar la factura como crédito fiscal en su F29.</p>`,
  },
  {
    slug: "iva-chile-como-calcular",
    title: "Cómo calcular el IVA en Chile: fórmulas y ejemplos",
    description: "El IVA en Chile es del 19%. Aprende a calcularlo correctamente: precio neto, precio bruto, débito y crédito fiscal con ejemplos prácticos.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 4,
    category: "Impuestos",
    excerpt: "IVA = 19% del precio neto, redondeado hacia abajo al peso entero. Te explicamos las fórmulas y casos especiales.",
    content: `<p>El Impuesto al Valor Agregado (IVA) en Chile es del 19% sobre el precio neto de los bienes y servicios.</p>
<h2>Fórmula del IVA</h2>
<p>IVA = Precio neto × 0,19 (redondeado hacia abajo al entero más cercano). Precio bruto = Precio neto + IVA.</p>
<h2>Ejemplo práctico</h2>
<p>Servicio de $100.000 neto: IVA = $19.000. Precio final = $119.000. Para calcular el neto desde el bruto: Neto = Bruto ÷ 1,19.</p>`,
  },
  {
    slug: "certificacion-dte-sii",
    title: "Proceso de certificación DTE con el SII: guía completa",
    description: "Para emitir DTE en Chile debes certificarte ante el SII. Te explicamos los pasos, los juegos de prueba y cuánto demora el proceso.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 10,
    category: "Facturación",
    excerpt: "La certificación DTE ante el SII puede demorar entre 30 y 120 días. Aprende los pasos: registro, juegos de prueba y ambiente de producción.",
    content: `<p>La certificación DTE es el proceso mediante el cual el SII valida que tu software puede emitir documentos tributarios electrónicos correctamente.</p>
<h2>Etapas del proceso</h2>
<p>1. Registro en el ambiente de certificación (maullin.sii.cl). 2. Envío de juegos de prueba (set de pruebas por tipo de DTE). 3. Resolución del SII (entre 30 y 120 días hábiles). 4. Habilitación en ambiente de producción (api.sii.cl).</p>`,
  },
  {
    slug: "libro-compras-ventas-chile",
    title: "Libro de compras y ventas: obligaciones en Chile",
    description: "El libro de compras y ventas es un registro tributario obligatorio en Chile. Aprende qué incluye, cómo se genera y cuándo presentarlo al SII.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 7,
    category: "Contabilidad",
    excerpt: "Toda empresa con giro debe llevar libro de compras y ventas. Se genera automáticamente desde los DTE registrados en el SII.",
    content: `<p>El libro de compras y ventas es un registro de todos los documentos tributarios emitidos y recibidos durante un período tributario.</p>
<h2>¿Quién debe llevarlo?</h2>
<p>Toda empresa o persona natural con giro afecta a IVA debe llevar este registro. Es la base para completar el F29 mensual.</p>
<h2>¿Cómo se genera?</h2>
<p>Desde 2017, el SII genera automáticamente el Registro de Compras y Ventas (RCV) basado en los DTE emitidos y recibidos electrónicamente.</p>`,
  },
  {
    slug: "ppm-chile-que-es",
    title: "PPM en Chile: qué es y cómo calcularlo",
    description: "Los Pagos Provisionales Mensuales (PPM) son anticipos del impuesto a la renta. Aprende qué son, quiénes deben pagarlos y cómo calcularlos.",
    date: "2026-05-19",
    lastModified: "2026-05-19",
    readTime: 6,
    category: "Impuestos",
    excerpt: "El PPM es un anticipo del impuesto a la renta que se declara mensualmente en el F29. La tasa varía según el tipo de contribuyente.",
    content: `<p>Los Pagos Provisionales Mensuales (PPM) son adelantos del impuesto anual a la renta (F22) que las empresas pagan mensualmente al SII.</p>
<h2>¿Quiénes pagan PPM?</h2>
<p>Todas las empresas de primera categoría (sociedades, EIRL, SpA) y los profesionales de segunda categoría con boleta de honorarios.</p>
<h2>¿Cómo se calcula?</h2>
<p>El PPM obligatorio se calcula como un porcentaje de los ingresos brutos del mes. La tasa la fija el SII anualmente según el resultado del año anterior.</p>`,
  },
]

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug)
}

export function getAllSlugs(): string[] {
  return blogPosts.map((p) => p.slug)
}
