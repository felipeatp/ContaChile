import { prisma } from '@contachile/db'
import { runAgent, AgentTool } from '../base-agent'

const INSIGHTS_SYSTEM_PROMPT = `Eres el Analista Proactivo de ContaChile. Tu misión es generar 2 o 3 "insights" financieros breves y accionables para el dashboard del usuario basándote en los datos contables del mes actual y anterior.

## REGLAS DE GENERACIÓN
- Sé extremadamente breve (máximo 15 palabras por insight).
- No repitas fechas de vencimiento obvias (eso ya lo hace otro módulo).
- Enfócate en: estimación de IVA, documentos pendientes de reconciliación, tendencias de gasto o alertas de liquidez.
- Usa un tono profesional pero cercano.
- Si no hay datos suficientes para un insight inteligente, no inventes; sé genérico pero útil.

## FORMATO DE SALIDA
Debes responder ÚNICAMENTE con una lista JSON de objetos con "text" e "icon" (lucide-react name).
Ejemplo:
[
  { "text": "IVA estimado de $450.000. Tienes 3 facturas por aceptar.", "icon": "Calculator" },
  { "text": "Tus gastos en 'Servicios' subieron 15% este mes.", "icon": "TrendingUp" }
]`

const TOOLS: AgentTool[] = [
  {
    name: 'get_financial_snapshot',
    description: 'Obtiene un resumen de ventas, compras y documentos pendientes del mes actual y anterior.',
    input_schema: { type: 'object', properties: {} },
  },
]

export interface Insight {
  text: string
  icon: string
}

export async function generateProactiveInsights(companyId: string): Promise<Insight[]> {
  const response = await runAgent({
    systemPrompt: INSIGHTS_SYSTEM_PROMPT,
    userMessage: 'Genera 2 o 3 insights para el dashboard basados en mis datos actuales.',
    tools: TOOLS,
    model: 'claude-sonnet-4-6',
    maxTokens: 512,
    onToolCall: async (name) => {
      if (name === 'get_financial_snapshot') {
        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()
        
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const prevMonth = prevMonthDate.getMonth() + 1
        const prevYear = prevMonthDate.getFullYear()

        const [currDocs, prevDocs, currPurchases, prevPurchases] = await Promise.all([
          prisma.document.findMany({ where: { companyId, emittedAt: { gte: new Date(currentYear, currentMonth - 1, 1), lt: new Date(currentYear, currentMonth, 1) } } }),
          prisma.document.findMany({ where: { companyId, emittedAt: { gte: new Date(prevYear, prevMonth - 1, 1), lt: new Date(prevYear, prevMonth, 1) } } }),
          prisma.purchase.findMany({ where: { companyId, date: { gte: new Date(currentYear, currentMonth - 1, 1), lt: new Date(currentYear, currentMonth, 1) } } }),
          prisma.purchase.findMany({ where: { companyId, date: { gte: new Date(prevYear, prevMonth - 1, 1), lt: new Date(prevYear, prevMonth, 1) } } }),
        ])

        const pendingAcceptance = currDocs.filter(d => d.status === 'PENDING').length
        const totalSalesCurr = currDocs.filter(d => d.status === 'ACCEPTED').reduce((s, d) => s + d.totalAmount, 0)
        const totalPurchasesCurr = currPurchases.reduce((s, p) => s + p.totalAmount, 0)
        const totalSalesPrev = prevDocs.filter(d => d.status === 'ACCEPTED').reduce((s, d) => s + d.totalAmount, 0)

        return {
          currentMonth: { sales: totalSalesCurr, purchases: totalPurchasesCurr, pending: pendingAcceptance },
          previousMonth: { sales: totalSalesPrev },
          deltaSales: totalSalesPrev > 0 ? ((totalSalesCurr - totalSalesPrev) / totalSalesPrev) * 100 : 0
        }
      }
      return { error: 'Tool not found' }
    }
  })

  try {
    // Extraer JSON de la respuesta del modelo (a veces envuelve en markdown)
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch (e) {
    // Error parsing AI insights
    return []
  }
}
