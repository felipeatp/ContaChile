/**
 * Smoke E2E del Consultor IA con contexto + tool use.
 *
 * Requisitos:
 *   - apps/api corriendo (pnpm --filter @contachile/api dev)
 *   - .env de apps/api con LLM_PROVIDER=anthropic y key de Kimi
 *   - DATABASE_URL apuntando al Postgres local
 *
 * Run desde repo root:
 *   $env:DATABASE_URL="postgresql://contachile:contachile@localhost:5432/contachile"
 *   apps/api/node_modules/.bin/tsx.CMD apps/api/scripts/smoke-ai-consultor.ts
 */

import { PrismaClient } from '@contachile/db'

const prisma = new PrismaClient()
const COMPANY_ID = 'dev-test-company'
const API = 'http://localhost:3001'

interface SseEvent {
  text?: string
  tool?: string
  status?: string
  error?: string
}

async function postChat(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  const res = await fetch(`${API}/ai/consultor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-company-id': COMPANY_ID },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const events: SseEvent[] = []
  let text = ''
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') continue
      try {
        const evt = JSON.parse(payload) as SseEvent
        events.push(evt)
        if (evt.text) text += evt.text
      } catch {}
    }
  }
  return { events, text }
}

async function seed() {
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: {
      id: COMPANY_ID,
      rut: '76.000.000-0',
      name: 'Empresa Smoke SpA',
      giro: 'Pruebas de consultor IA',
      siiCertified: false,
    },
  })

  const folio = 99001
  await prisma.document.upsert({
    where: { id: `${COMPANY_ID}-smoke-${folio}` },
    update: {},
    create: {
      id: `${COMPANY_ID}-smoke-${folio}`,
      companyId: COMPANY_ID,
      type: 33,
      folio,
      receiverRut: '77.777.777-7',
      receiverName: 'Cliente Smoke',
      totalNet: 200000,
      totalTax: 38000,
      totalAmount: 238000,
      status: 'ACCEPTED',
      emittedAt: new Date(),
      paymentMethod: 'CONTADO',
    },
  })
  return folio
}

async function testGeneral() {
  console.log('\n=== Test 1: pregunta general (sin tools esperadas) ===')
  const { events, text } = await postChat([
    { role: 'user', content: '¿Cuál es la tasa de IVA en Chile?' },
  ])
  const toolEvents = events.filter(e => e.tool)
  console.log(`  events: ${events.length}, tool events: ${toolEvents.length}`)
  console.log(`  respuesta: ${text.slice(0, 120)}...`)
  if (toolEvents.length > 0) {
    console.log('  [WARN] hubo tool calls pero la pregunta era general (no es fail)')
  }
  if (!/19/.test(text)) console.log('  [FAIL] respuesta no contiene "19"')
  else console.log('  [OK]')
}

async function testMonthlySummary() {
  console.log('\n=== Test 2: pregunta del mes (espera get_monthly_summary) ===')
  const { events, text } = await postChat([
    { role: 'user', content: '¿Cuántos DTE he emitido este mes y por cuánto?' },
  ])
  const toolEvents = events.filter(e => e.tool === 'get_monthly_summary')
  console.log(`  tool events: ${toolEvents.length}, eventos total: ${events.length}`)
  console.log(`  respuesta: ${text.slice(0, 200)}...`)
  if (toolEvents.length === 0) console.log('  [WARN] no se llamó get_monthly_summary; el snapshot pudo bastar')
  else console.log('  [OK] tool invocada')
}

async function testFindDocument(folio: number) {
  console.log(`\n=== Test 3: pregunta por folio ${folio} (espera find_documents) ===`)
  const { events, text } = await postChat([
    { role: 'user', content: `¿Qué dice la factura ${folio}?` },
  ])
  const toolEvents = events.filter(e => e.tool === 'find_documents')
  console.log(`  tool events: ${toolEvents.length}`)
  console.log(`  respuesta: ${text.slice(0, 200)}...`)
  if (toolEvents.length === 0) console.log('  [FAIL] no se llamó find_documents')
  else if (!text.includes('Cliente Smoke')) console.log('  [FAIL] respuesta no menciona al receptor')
  else console.log('  [OK]')
}

async function main() {
  const folio = await seed()
  await testGeneral()
  await testMonthlySummary()
  await testFindDocument(folio)
  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
