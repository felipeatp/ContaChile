/**
 * Test script: verifica conectividad con NVIDIA NIM (o cualquier proveedor OpenAI-compat)
 *
 * Ejecutar desde apps/api/ en tu terminal (Windows):
 *
 *   Opción A — con tsx (requiere pnpm install):
 *     npx dotenv -e .env -- ./node_modules/.bin/tsx src/test-nim.ts
 *
 *   Opción B — compilar con tsc y ejecutar con node:
 *     npx tsc src/test-nim.ts --outDir /tmp --module commonjs --target es2020 --esModuleInterop
 *     OPENAI_COMPAT_API_KEY=nvapi-... node /tmp/test-nim.js
 *
 *   Opción C — curl (más simple, no requiere Node):
 *     curl -s https://integrate.api.nvidia.com/v1/models \
 *       -H "Authorization: Bearer nvapi-YHsNp0Te..." | python -m json.tool
 */

import OpenAI from 'openai'

const API_KEY = process.env.OPENAI_COMPAT_API_KEY || ''
const BASE_URL = process.env.OPENAI_COMPAT_BASE_URL || 'https://integrate.api.nvidia.com/v1'
const MODEL = process.env.OPENAI_COMPAT_MODEL || 'deepseek-ai/deepseek-r1'

console.log('─────────────────────────────────────────')
console.log('NIM Connectivity Test')
console.log('─────────────────────────────────────────')
console.log(`BASE_URL : ${BASE_URL}`)
console.log(`MODEL    : ${MODEL}`)
console.log(`API_KEY  : ${API_KEY ? API_KEY.slice(0, 12) + '...' : '(no configurada)'}`)
console.log('─────────────────────────────────────────\n')

if (!API_KEY) {
  console.error('ERROR: OPENAI_COMPAT_API_KEY no esta configurada.')
  console.error('       Asegurate de correr con dotenv o exportar la variable antes.')
  process.exit(1)
}

const client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL })

// ─── 1. Listar modelos disponibles ────────────────────────────────────────────
async function listModels() {
  console.log('1. Listando modelos disponibles...')
  try {
    const models = await client.models.list()
    const ids = models.data.map((m) => m.id)
    if (ids.length === 0) {
      console.log('   (sin modelos o endpoint no soporta GET /models)')
    } else {
      ids.slice(0, 25).forEach((id) => console.log(`   - ${id}`))
      if (ids.length > 25) console.log(`   ... y ${ids.length - 25} mas`)
      const deepseek = ids.filter((id) => id.includes('deepseek'))
      console.log(`\n   Modelos deepseek: ${deepseek.join(', ') || '(ninguno)'}`)
      if (ids.length > 0 && !ids.includes(MODEL)) {
        console.warn(`   ADVERTENCIA: '${MODEL}' no aparece en la lista.`)
      } else if (ids.includes(MODEL)) {
        console.log(`   OK: '${MODEL}' disponible.`)
      }
    }
  } catch (err) {
    console.log(`   No se pudo listar modelos: ${(err as Error).message}`)
  }
  console.log()
}

// ─── 2. Chat completion simple (sin streaming) ────────────────────────────────
async function testCompletion() {
  console.log(`2. Chat completion (sin streaming) con: ${MODEL}`)
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: 'Di exactamente: "NIM OK"' }],
      max_tokens: 50,
      stream: false,
    })
    const text = response.choices[0]?.message?.content ?? '(sin respuesta)'
    console.log(`   Respuesta: ${text.trim()}`)
    console.log('   OK: Chat completion funciona\n')
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; error?: { message?: string } }
    console.error(`   ERROR: ${e.message || JSON.stringify(e)}`)
    if (e.status) console.error(`   Status HTTP: ${e.status}`)
    if (e.error?.message) console.error(`   Detalle API: ${e.error.message}`)
    console.log()
  }
}

// ─── 3. Streaming ────────────────────────────────────────────────────────────
async function testStreaming() {
  console.log(`3. Streaming con: ${MODEL}`)
  try {
    const stream = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: 'Cuenta del 1 al 5, separando con coma.' }],
      max_tokens: 60,
      stream: true,
    })
    process.stdout.write('   Stream: ')
    let total = ''
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) {
        process.stdout.write(delta)
        total += delta
      }
    }
    console.log('\n   OK: Streaming funciona\n')
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    console.error(`   ERROR en streaming: ${e.message || JSON.stringify(e)}`)
    if (e.status) console.error(`   Status HTTP: ${e.status}`)
    console.log()
  }
}

async function run() {
  await listModels()
  await testCompletion()
  await testStreaming()
  console.log('─────────────────────────────────────────')
}

run().catch(console.error)
