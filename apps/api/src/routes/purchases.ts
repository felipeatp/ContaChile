import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { PurchaseSchema, PurchaseListQuerySchema } from '@contachile/validators'

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, 'i'))
  return match ? match[1].trim() : undefined
}

function parsePurchaseXml(xml: string): {
  type: number
  folio: number
  date: string
  issuerRut: string
  issuerName: string
  netAmount: number
  taxAmount: number
  totalAmount: number
} | null {
  const typeStr = extractTag(xml, 'TipoDTE')
  const folioStr = extractTag(xml, 'Folio')
  const dateStr = extractTag(xml, 'FchEmis')
  const issuerRut = extractTag(xml, 'RUTEmisor')
  const issuerName = extractTag(xml, 'RznSoc') || extractTag(xml, 'RznSocEmis')
  const netStr = extractTag(xml, 'MntNeto')
  const taxStr = extractTag(xml, 'IVA')
  const totalStr = extractTag(xml, 'MntTotal')

  if (!typeStr || !folioStr || !dateStr || !issuerRut || !issuerName) {
    return null
  }

  const type = parseInt(typeStr, 10)
  const folio = parseInt(folioStr, 10)
  const netAmount = netStr ? parseInt(netStr, 10) : 0
  const taxAmount = taxStr ? parseInt(taxStr, 10) : 0
  const totalAmount = totalStr ? parseInt(totalStr, 10) : netAmount + taxAmount

  if (isNaN(type) || isNaN(folio)) {
    return null
  }

  return {
    type,
    folio,
    date: dateStr,
    issuerRut,
    issuerName,
    netAmount,
    taxAmount,
    totalAmount,
  }
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/purchases', async (request, reply) => {
    const companyId = request.companyId
    const query = request.query as Record<string, string | undefined>

    const parsed = PurchaseListQuerySchema.safeParse(query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }

    const { year, month, page, limit } = parsed.data

    const where: Record<string, unknown> = { companyId }

    if (year || month) {
      const startYear = year ? parseInt(year, 10) : new Date().getFullYear()
      const startMonth = month ? parseInt(month, 10) - 1 : 0
      const endMonth = month ? parseInt(month, 10) - 1 : 11

      const startDate = new Date(startYear, startMonth, 1)
      const endDate = new Date(startYear, endMonth + 1, 1)

      where.date = { gte: startDate, lt: endDate }
    }

    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.purchase.count({ where }),
    ])

    return reply.send({ purchases, total, page: pageNum, limit: limitNum })
  })

  fastify.post('/purchases', async (request, reply) => {
    const companyId = request.companyId
    const body = request.body as Record<string, unknown>

    const parsed = PurchaseSchema.safeParse(body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }

    const data = parsed.data

    const purchase = await prisma.purchase.create({
      data: {
        companyId,
        type: data.type,
        folio: data.folio,
        issuerRut: data.issuerRut,
        issuerName: data.issuerName,
        date: new Date(data.date),
        netAmount: data.netAmount,
        taxAmount: data.taxAmount,
        totalAmount: data.totalAmount,
        category: data.category,
      },
    })

    return reply.code(201).send(purchase)
  })

  fastify.post('/purchases/import-xml', async (request, reply) => {
    const companyId = request.companyId
    const body = request.body as { xmlContent?: string }

    if (!body.xmlContent || body.xmlContent.length < 100) {
      return reply.code(400).send({ error: 'XML inválido o vacío' })
    }

    const parsed = parsePurchaseXml(body.xmlContent)
    if (!parsed) {
      return reply.code(400).send({ error: 'No se pudieron extraer los datos del XML. Verifica que sea un DTE válido.' })
    }

    const existing = await prisma.purchase.findFirst({
      where: {
        companyId,
        issuerRut: parsed.issuerRut,
        folio: parsed.folio,
        type: parsed.type,
      },
    })

    if (existing) {
      return reply.code(409).send({ error: 'Esta compra ya fue registrada', id: existing.id })
    }

    const purchase = await prisma.purchase.create({
      data: {
        companyId,
        type: parsed.type,
        folio: parsed.folio,
        issuerRut: parsed.issuerRut,
        issuerName: parsed.issuerName,
        date: new Date(parsed.date),
        netAmount: parsed.netAmount,
        taxAmount: parsed.taxAmount,
        totalAmount: parsed.totalAmount,
      },
    })

    return reply.code(201).send(purchase)
  })
}
