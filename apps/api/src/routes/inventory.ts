import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import {
  CreateProductSchema,
  UpdateProductSchema,
  InventoryMovementSchema,
} from '@contachile/validators'
import { recordInventoryMovement } from '../lib/inventory-service'

export default async function (fastify: FastifyInstance) {
  fastify.get('/inventory/products', async (request, reply) => {
    const companyId = request.companyId
    const { active, search } = request.query as { active?: string; search?: string }

    const where: Record<string, unknown> = { companyId }
    if (active === 'true') where.isActive = true
    if (active === 'false') where.isActive = false
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ]
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    })
    return reply.send({ products })
  })

  fastify.get('/inventory/products/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const product = await prisma.product.findFirst({ where: { id, companyId } })
    if (!product) return reply.code(404).send({ error: 'Producto no encontrado' })
    return reply.send(product)
  })

  fastify.post('/inventory/products', async (request, reply) => {
    const companyId = request.companyId
    const parsed = CreateProductSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }
    const data = parsed.data

    const existing = await prisma.product.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    })
    if (existing) return reply.code(409).send({ error: 'Ya existe producto con ese código' })

    const product = await prisma.product.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        description: data.description,
        unit: data.unit,
        salePrice: data.salePrice,
        costPrice: data.costPrice,
        minStock: data.minStock,
        affectedIVA: data.affectedIVA,
        stock: 0,
      },
    })

    if (data.initialStock > 0) {
      await recordInventoryMovement(
        {
          companyId,
          productId: product.id,
          type: 'IN',
          quantity: data.initialStock,
          unitCost: data.costPrice,
          reason: 'initial',
          notes: 'Stock inicial al crear producto',
        },
        fastify.log
      )
    }

    const refreshed = await prisma.product.findUnique({ where: { id: product.id } })
    return reply.code(201).send(refreshed)
  })

  fastify.patch('/inventory/products/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const parsed = UpdateProductSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }

    const existing = await prisma.product.findFirst({ where: { id, companyId } })
    if (!existing) return reply.code(404).send({ error: 'Producto no encontrado' })

    const updated = await prisma.product.update({
      where: { id },
      data: parsed.data,
    })
    return reply.send(updated)
  })

  fastify.delete('/inventory/products/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const existing = await prisma.product.findFirst({ where: { id, companyId } })
    if (!existing) return reply.code(404).send({ error: 'Producto no encontrado' })

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    })
    return reply.code(204).send()
  })

  fastify.get('/inventory/movements/:productId', async (request, reply) => {
    const companyId = request.companyId
    const { productId } = request.params as { productId: string }
    const { from, to } = request.query as { from?: string; to?: string }

    const product = await prisma.product.findFirst({ where: { id: productId, companyId } })
    if (!product) return reply.code(404).send({ error: 'Producto no encontrado' })

    const where: Record<string, unknown> = { productId }
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range.gte = new Date(from)
      if (to) range.lte = new Date(to + 'T23:59:59')
      where.createdAt = range
    }

    const movements = await prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })

    let runningStock = 0
    const kardex = movements.map((m) => {
      runningStock += m.type === 'IN' ? m.quantity : -m.quantity
      return {
        ...m,
        balance: runningStock,
        value: m.quantity * m.unitCost,
      }
    })

    return reply.send({ product, movements: kardex })
  })

  fastify.post('/inventory/movements', async (request, reply) => {
    const companyId = request.companyId
    const parsed = InventoryMovementSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }
    const data = parsed.data

    try {
      const result = await recordInventoryMovement(
        {
          companyId,
          productId: data.productId,
          type: data.type,
          quantity: data.quantity,
          unitCost: data.unitCost,
          reason: data.reason,
          reference: data.reference,
          notes: data.notes,
        },
        fastify.log
      )
      return reply.code(201).send(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error'
      return reply.code(400).send({ error: msg })
    }
  })

  fastify.get('/inventory/alerts', async (request, reply) => {
    const companyId = request.companyId
    const products = await prisma.product.findMany({
      where: { companyId, isActive: true },
    })
    const lowStock = products.filter((p) => p.stock <= p.minStock && p.minStock > 0)
    return reply.send({ alerts: lowStock })
  })
}
