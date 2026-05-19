import { runAgent } from '../base-agent'

export interface OCRResult {
  tipo: 'boleta' | 'factura' | 'recibo' | 'desconocido'
  numero: string | null
  fecha: string | null // DD/MM/YYYY
  rutEmisor: string | null
  nombreEmisor: string | null
  montoNeto: number | null
  iva: number | null
  montoTotal: number | null
  descripcion: string | null
  confianza: number // 0-1
}

const SYSTEM_PROMPT = `Eres un asistente de OCR especializado en documentos tributarios chilenos.

Analiza la imagen proporcionada y extrae exactamente los siguientes campos:
1. tipo: "boleta", "factura", "recibo", o "desconocido"
2. numero: número de documento (solo dígitos, sin puntos)
3. fecha: formato DD/MM/YYYY
4. rutEmisor: RUT chileno con dígito verificador (XX.XXX.XXX-X)
5. nombreEmisor: nombre o razón social del emisor
6. montoNeto: monto neto (sin IVA) en pesos chilenos, solo número
7. iva: IVA (19% del neto si es factura afecta), solo número
8. montoTotal: monto total pagado, solo número
9. descripcion: descripción breve de lo comprado o servicio recibido
10. confianza: número entre 0 y 1 indicando confianza en la extracción

REGLAS:
- Si algún dato no es visible, devuélvelo como null (no inventes).
- Si el documento no es un comprobante de pago chileno, tipo = "desconocido".
- El IVA en Chile es 19% sobre el neto para facturas afectas.
- Responde ÚNICAMENTE en formato JSON válido, sin markdown ni texto adicional.

Formato de respuesta (JSON estricto):
{
  "tipo": "...",
  "numero": "...",
  "fecha": "...",
  "rutEmisor": "...",
  "nombreEmisor": "...",
  "montoNeto": 12345,
  "iva": 2345,
  "montoTotal": 14690,
  "descripcion": "...",
  "confianza": 0.95
}`

export async function procesarDocumentoOCR(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<OCRResult> {
  const result = await runAgent({
    systemPrompt: SYSTEM_PROMPT,
    model: 'claude-sonnet-4-6',
    maxTokens: 2048,
    userMessage: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType as any,
          data: imageBase64,
        },
      },
      {
        type: 'text',
        text: 'Extrae los datos de este documento tributario chileno. Responde solo en JSON.',
      },
    ] as any,
  })

  try {
    // Intenta extraer JSON de la respuesta
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[0] : result
    const parsed = JSON.parse(jsonStr)

    return {
      tipo: parsed.tipo || 'desconocido',
      numero: parsed.numero || null,
      fecha: parsed.fecha || null,
      rutEmisor: parsed.rutEmisor || null,
      nombreEmisor: parsed.nombreEmisor || null,
      montoNeto: parsed.montoNeto || parsed.monto_neto || null,
      iva: parsed.iva || null,
      montoTotal: parsed.montoTotal || parsed.monto_total || null,
      descripcion: parsed.descripcion || null,
      confianza: typeof parsed.confianza === 'number' ? parsed.confianza : 0.5,
    }
  } catch {
    return {
      tipo: 'desconocido',
      numero: null,
      fecha: null,
      rutEmisor: null,
      nombreEmisor: null,
      montoNeto: null,
      iva: null,
      montoTotal: null,
      descripcion: null,
      confianza: 0,
    }
  }
}
