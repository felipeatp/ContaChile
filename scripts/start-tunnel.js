#!/usr/bin/env node
/**
 * Script para levantar un tunnel ngrok al puerto 3000 (web app)
 * y actualizar automáticamente las URLs en los archivos .env
 *
 * Uso: node scripts/start-tunnel.js
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')

const WEB_ENV_PATH = path.join(__dirname, '..', 'apps', 'web', '.env.local')
const MOBILE_ENV_PATH = path.join(__dirname, '..', 'apps', 'mobile', '.env')
const NGROK_API = 'http://127.0.0.1:4040/api/tunnels'

function log(msg) {
  console.log(`[tunnel] ${msg}`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function updateEnvFile(filePath, key, value) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`)
  }

  let content = fs.readFileSync(filePath, 'utf-8')
  const regex = new RegExp(`^${key}=.*$`, 'm')

  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`)
  } else {
    content += `\n${key}=${value}\n`
  }

  fs.writeFileSync(filePath, content)
  log(`Actualizado ${path.basename(filePath)}: ${key}=${value}`)
}

async function getNgrokUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const data = await new Promise((resolve, reject) => {
        http
          .get(NGROK_API, (res) => {
            let body = ''
            res.on('data', (chunk) => (body += chunk))
            res.on('end', () => resolve(body))
          })
          .on('error', reject)
      })

      const json = JSON.parse(data)
      const tunnel = json.tunnels.find((t) => t.proto === 'https')
      if (tunnel) {
        return tunnel.public_url
      }
    } catch {
      // ngrok aún no está listo
    }
    await sleep(1000)
  }
  throw new Error('No se pudo obtener la URL de ngrok')
}

async function main() {
  log('Iniciando ngrok en puerto 3000...')
  const ngrok = spawn('ngrok', ['http', '3000'], {
    stdio: 'pipe',
    shell: true,
  })

  ngrok.stdout.on('data', (data) => {
    // ngrok v3 no imprime mucho en stdout, pero dejamos el handler por si acaso
  })

  ngrok.stderr.on('data', (data) => {
    const msg = data.toString().trim()
    if (msg) log(`ngrok: ${msg}`)
  })

  ngrok.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      log(`ngrok terminó con código ${code}`)
      process.exit(1)
    }
  })

  process.on('SIGINT', () => {
    log('Cerrando ngrok...')
    ngrok.kill('SIGINT')
    process.exit(0)
  })

  // Esperar a que ngrok esté listo
  await sleep(3000)

  const url = await getNgrokUrl()
  log(`Tunnel activo: ${url}`)

  // Actualizar archivos .env
  updateEnvFile(WEB_ENV_PATH, 'BETTER_AUTH_URL', url)
  updateEnvFile(MOBILE_ENV_PATH, 'EXPO_PUBLIC_AUTH_BASE_URL', url)

  // Imprimir instrucciones
  console.log('\n' + '='.repeat(60))
  console.log('✅ TUNNEL ACTIVO')
  console.log('='.repeat(60))
  console.log(`\nURL pública: ${url}`)
  console.log(`\n📋 PASOS RESTANTES:`)
  console.log(`   1. Registra este redirect URI en Google Cloud Console:`)
  console.log(`      ${url}/api/auth/callback/google`)
  console.log(`   2. Reinicia la web app (Next.js) para que lea el nuevo .env`)
  console.log(`   3. Reinicia el bundler de Expo (si estaba corriendo)`)
  console.log(`   4. La app mobile ya apunta automáticamente a: ${url}`)
  console.log(`\n⚠️  Cuando cierres este script, la URL de ngrok morirá.`)
  console.log(`    Tendrás que registrar un nuevo redirect URI en Google.`)
  console.log(`    Para evitar esto, usa ngrok con un dominio fijo (pago)`)
  console.log(`    o considera migrar al flujo nativo (Opción B).`)
  console.log('\n' + '='.repeat(60) + '\n')

  // Mantener el script vivo mientras ngrok corre
  await new Promise(() => {})
}

main().catch((err) => {
  console.error('[tunnel] Error:', err.message)
  process.exit(1)
})
