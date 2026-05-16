/**
 * Smoke test for inventory module.
 *
 * Run: $env:DATABASE_URL="postgresql://contachile:contachile@localhost:5432/contachile"
 *      apps/api/node_modules/.bin/tsx.CMD apps/api/scripts/smoke-inventory.ts
 */

import { PrismaClient } from '../../../packages/db/generated/client'
import {
  recordInventoryMovement,
  recordSalesMovements,
} from '../src/lib/inventory-service'

const prisma = new PrismaClient()
const COMPANY_ID = 'dev-test-company'

const logger = { warn: (data: object, msg: string) => console.log('[WARN]', msg, JSON.stringify(data)) }

async function cleanup() {
  // Delete inventory movements, then products
  const products = await prisma.product.findMany({
    where: { companyId: COMPANY_ID, code: { in: ['SMOKE-001', 'SMOKE-002'] } },
  })
  if (products.length > 0) {
    const productIds = products.map((p) => p.id)
    await prisma.inventoryMovement.deleteMany({ where: { productId: { in: productIds } } })
    // Clear references in DocumentItems
    await prisma.documentItem.updateMany({
      where: { productId: { in: productIds } },
      data: { productId: null },
    })
    await prisma.product.deleteMany({ where: { id: { in: productIds } } })
  }
}

async function testCreateAndInitial() {
  console.log('=== Test 1: crear producto con stock inicial ===')
  const p = await prisma.product.create({
    data: {
      companyId: COMPANY_ID,
      code: 'SMOKE-001',
      name: 'Producto Smoke 1',
      unit: 'unidad',
      salePrice: 1500,
      costPrice: 1000,
      minStock: 5,
      stock: 0,
    },
  })
  await recordInventoryMovement(
    { companyId: COMPANY_ID, productId: p.id, type: 'IN', quantity: 10, unitCost: 1000, reason: 'initial' },
    logger
  )

  const refreshed = await prisma.product.findUnique({ where: { id: p.id } })
  if (!refreshed) return null
  console.log(`Producto creado: stock=${refreshed.stock}, costPrice=${refreshed.costPrice}`)
  if (refreshed.stock !== 10 || refreshed.costPrice !== 1000) {
    console.log(`[FAIL] esperado stock 10 y costo 1000`)
    return null
  }
  console.log('[OK] Producto creado con stock 10 a costo $1.000')
  return refreshed
}

async function testWeightedAverage(productId: string) {
  console.log('\n=== Test 2: costo promedio ponderado ===')
  await recordInventoryMovement(
    { companyId: COMPANY_ID, productId, type: 'IN', quantity: 5, unitCost: 1200, reason: 'purchase' },
    logger
  )
  const p = await prisma.product.findUnique({ where: { id: productId } })
  if (!p) return false
  // (10*1000 + 5*1200) / 15 = 16000/15 = 1066.67 → 1067
  console.log(`Después de IN 5@$1200: stock=${p.stock}, costPrice=${p.costPrice}`)
  if (p.stock !== 15) {
    console.log(`[FAIL] stock esperado 15, obtuvo ${p.stock}`)
    return false
  }
  if (p.costPrice !== 1067) {
    console.log(`[FAIL] costo promedio esperado 1067, obtuvo ${p.costPrice}`)
    return false
  }
  console.log('[OK] Costo promedio ponderado correcto: 1067')
  return true
}

async function testOutMovement(productId: string) {
  console.log('\n=== Test 3: OUT usa snapshot del costPrice ===')
  const { movement } = await recordInventoryMovement(
    { companyId: COMPANY_ID, productId, type: 'OUT', quantity: 3, reason: 'manual' },
    logger
  )
  const p = await prisma.product.findUnique({ where: { id: productId } })
  if (!p) return false
  console.log(`Después de OUT 3: stock=${p.stock}, movement.unitCost=${movement.unitCost}`)
  if (p.stock !== 12) {
    console.log(`[FAIL] stock esperado 12, obtuvo ${p.stock}`)
    return false
  }
  if (movement.unitCost !== 1067) {
    console.log(`[FAIL] OUT debería usar costPrice actual (1067) como snapshot`)
    return false
  }
  if (p.costPrice !== 1067) {
    console.log(`[FAIL] costPrice no debe cambiar en OUT`)
    return false
  }
  console.log('[OK] OUT con snapshot $1067, stock=12, costo se mantiene')
  return true
}

async function testAlerts(productId: string) {
  console.log('\n=== Test 4: alerta de stock mínimo ===')

  // Crear segundo producto con stock=2 y minStock=5 → debe estar en alertas
  await prisma.product.create({
    data: {
      companyId: COMPANY_ID,
      code: 'SMOKE-002',
      name: 'Producto Smoke 2 (low)',
      unit: 'unidad',
      salePrice: 500,
      costPrice: 300,
      minStock: 5,
      stock: 2,
      isActive: true,
    },
  })

  // El primer producto tiene stock=12 y minStock=5 → no debe estar en alertas
  const lowStockProducts = await prisma.product.findMany({
    where: { companyId: COMPANY_ID, isActive: true },
  })
  const alerts = lowStockProducts.filter((p) => p.stock <= p.minStock && p.minStock > 0)

  const codes = alerts.map((a) => a.code).sort()
  console.log(`Productos en alerta: ${codes.join(', ')}`)
  if (!codes.includes('SMOKE-002')) {
    console.log('[FAIL] SMOKE-002 debería estar en alerta (stock=2 ≤ minStock=5)')
    return false
  }
  if (codes.includes('SMOKE-001')) {
    console.log('[FAIL] SMOKE-001 no debería estar en alerta (stock=12 > minStock=5)')
    return false
  }
  console.log('[OK] SMOKE-002 en alerta, SMOKE-001 con stock saludable')
  return true
}

async function testRecordSalesMovements(productId: string) {
  console.log('\n=== Test 5: recordSalesMovements (simula auto-decrement de DTE) ===')

  const stockBefore = (await prisma.product.findUnique({ where: { id: productId } }))?.stock
  if (stockBefore === undefined) return false

  // Simular DocumentItem con productId
  const fakeItems = [
    { documentItemId: 'fake-item-1', productId, quantity: 4 },
    { documentItemId: 'fake-item-2', productId: null, quantity: 1 }, // sin producto → skip
  ]
  const result = await recordSalesMovements(COMPANY_ID, '33-9999', fakeItems, logger)
  console.log(`Resultado: created=${result.created}, skipped=${result.skipped}`)

  const stockAfter = (await prisma.product.findUnique({ where: { id: productId } }))?.stock
  if (stockBefore - 4 !== stockAfter) {
    console.log(`[FAIL] esperado stock ${stockBefore - 4}, obtuvo ${stockAfter}`)
    return false
  }
  if (result.created !== 1 || result.skipped !== 1) {
    console.log(`[FAIL] esperado 1 created, 1 skipped`)
    return false
  }

  // Verificar que el movimiento OUT tiene reason='dte' y referencia
  const movements = await prisma.inventoryMovement.findMany({
    where: { productId, reason: 'dte' },
    orderBy: { createdAt: 'desc' },
    take: 1,
  })
  if (movements.length === 0) {
    console.log('[FAIL] no se creó movement con reason=dte')
    return false
  }
  if (movements[0].reference !== '33-9999') {
    console.log(`[FAIL] referencia inesperada: ${movements[0].reference}`)
    return false
  }
  console.log(`[OK] Auto-decrement: stock ${stockBefore} → ${stockAfter}, movement con reason=dte, ref=33-9999`)
  return true
}

async function main() {
  try {
    console.log('===== Smoke test: Inventario =====\n')
    await cleanup()
    const product = await testCreateAndInitial()
    if (!product) {
      await cleanup()
      process.exit(1)
    }
    const r2 = await testWeightedAverage(product.id)
    const r3 = r2 ? await testOutMovement(product.id) : false
    const r4 = await testAlerts(product.id)
    const r5 = r3 ? await testRecordSalesMovements(product.id) : false
    await cleanup()

    console.log('\n===== Resultado =====')
    console.log(`Test 1 (crear + stock inicial):       PASS`)
    console.log(`Test 2 (costo promedio ponderado):    ${r2 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 3 (OUT snapshot):                ${r3 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 4 (alertas minStock):            ${r4 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 5 (auto-decrement DTE):          ${r5 ? 'PASS' : 'FAIL'}`)

    process.exit(r2 && r3 && r4 && r5 ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
