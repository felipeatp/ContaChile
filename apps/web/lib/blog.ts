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
