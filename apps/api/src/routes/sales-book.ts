import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'

// Tipos de documento considerados ventas para el libro de ventas
const SALES_TYPES = [33, 34, 39, 41, 43]

function escapeCsv(value: unknown): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildSalesCsv(rows: Array<Record<string, unknown>>): string {
  const headers = ['Fecha', 'TipoDTE', 'Folio', 'RUTReceptor', 'RazonSocial', 'Neto', 'IVA', 'Total']
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(
      [
        escapeCsv(row.emittedAt),
        escapeCsv(row.type),
        escapeCsv(row.folio),
        escapeCsv(row.receiverRut),
        escapeCsv(row.receiverName),
        escapeCsv(row.totalNet),
        escapeCsv(row.totalTax),
        escapeCsv(row.totalAmount),
      ].join(',')
    )
  }
  return lines.join('\n')
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/sales-book', async (request, reply) => {
    const companyId = request.companyId
    const query = request.query as { year?: string; month?: string; page?: string; limit?: string }

    const page = parseInt(query.page || '1', 10)
    const limit = parseInt(query.limit || '50', 10)
    const skip = (page - 1) * limit

    const year = query.year ? parseInt(query.year, 10) : undefined
    const month = query.month ? parseInt(query.month, 10) : undefined

    const where: Record<string, unknown> = {
      companyId,
      type: { in: SALES_TYPES },
    }

    if (year !== undefined && month !== undefined) {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      where.emittedAt = { gte: start, lt: end }
    } else if (year !== undefined) {
      const start = new Date(year, 0, 1)
      const end = new Date(year + 1, 0, 1)
      where.emittedAt = { gte: start, lt: end }
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { emittedAt: 'desc' },
        skip,
        take: limit,
        include: { items: true },
      }),
      prisma.document.count({ where }),
    ])

    const totals = documents.reduce(
      (acc, doc) => {
        acc.net += doc.totalNet
        acc.tax += doc.totalTax
        acc.total += doc.totalAmount
        return acc
      },
      { net: 0, tax: 0, total: 0 }
    )

    return reply.send({
      documents,
      total,
      page,
      limit,
      summary: totals,
    })
  })

  fastify.get('/sales-book/export', async (request, reply) => {
    const companyId = request.companyId
    const query = request.query as { year?: string; month?: string }

    const year = query.year ? parseInt(query.year, 10) : undefined
    const month = query.month ? parseInt(query.month, 10) : undefined

    const where: Record<string, unknown> = {
      companyId,
      type: { in: SALES_TYPES },
    }

    if (year !== undefined && month !== undefined) {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      where.emittedAt = { gte: start, lt: end }
    } else if (year !== undefined) {
      const start = new Date(year, 0, 1)
      const end = new Date(year + 1, 0, 1)
      where.emittedAt = { gte: start, lt: end }
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: { emittedAt: 'asc' },
    })

    const csv = buildSalesCsv(documents as Array<Record<string, unknown>>)
    const filename = `LibroVentas_${year ?? 'todos'}${month ? String(month).padStart(2, '0') : ''}.csv`

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    return reply.send(csv)
  })
}
