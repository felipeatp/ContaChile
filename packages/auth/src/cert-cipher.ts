import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

function getKey(): Buffer {
  const hex = process.env.CERT_ENCRYPTION_KEY
  if (!hex) {
    throw new Error(
      'CERT_ENCRYPTION_KEY is not set. ' +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    )
  }
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) {
    throw new Error('CERT_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return key
}

export function encryptCertPassword(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Layout: iv (12 bytes) + tag (16 bytes) + ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptCertPassword(ciphertext: string): string {
  const key = getKey()
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const encrypted = buf.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
