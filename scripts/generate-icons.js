// scripts/generate-icons.js
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const outDir = path.join(__dirname, '../apps/web/public/icons')
fs.mkdirSync(outDir, { recursive: true })

const svgNormal = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="64" fill="#0f172a"/>
  <text x="256" y="310" font-size="200" font-family="Arial, sans-serif"
        font-weight="bold" fill="white" text-anchor="middle">CC</text>
</svg>`

const svgMaskable = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#0f172a"/>
  <text x="256" y="310" font-size="160" font-family="Arial, sans-serif"
        font-weight="bold" fill="white" text-anchor="middle">CC</text>
</svg>`

async function main() {
  const buf512 = Buffer.from(svgNormal)
  const bufMaskable = Buffer.from(svgMaskable)

  await sharp(buf512).png().toFile(path.join(outDir, 'icon-512.png'))
  console.log('icon-512.png')

  await sharp(buf512).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png'))
  console.log('icon-192.png')

  await sharp(bufMaskable).png().toFile(path.join(outDir, 'icon-512-maskable.png'))
  console.log('icon-512-maskable.png')

  console.log('Done:', outDir)
}

main().catch(err => { console.error(err); process.exit(1) })
