/**
 * sanitize.ts — Capa de defensa contra prompt injection y abuso de entrada en agentes IA.
 *
 * Aplicar ANTES de pasar cualquier input de usuario a un LLM.
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Máximo de chars por mensaje individual */
export const MAX_MESSAGE_CHARS = 4000

/** Máximo de chars totales en toda la conversación */
export const MAX_CONVERSATION_CHARS = 30_000

/** Máximo de mensajes en el historial */
export const MAX_MESSAGES = 50

// ─── Patrones de inyección conocidos ─────────────────────────────────────────
// Lista de patrones que son señales claras de intento de prompt injection.
// No busca ser exhaustiva — solo captura los más obvios y frecuentes.
const INJECTION_PATTERNS: RegExp[] = [
  // Override directo
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?/i,
  /forget\s+(everything|all|your|previous)/i,
  /disregard\s+(all|previous|prior|above)/i,

  // Asignación de rol nuevo
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /act\s+as\s+(a|an|the|if)\s+/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /roleplay\s+as/i,
  /from\s+now\s+on\s+(you\s+are|act|behave)/i,

  // Exfiltración del system prompt
  /repeat\s+(your\s+)?(system\s+prompt|instructions|prompt)/i,
  /show\s+me\s+(your\s+)?(system\s+prompt|prompt|instructions)/i,
  /what\s+(are\s+your|is\s+your)\s+(instructions|system\s+prompt|prompt)/i,
  /print\s+(your\s+)?(system|prompt|instructions)/i,
  /output\s+(your\s+)?(system\s+prompt|prompt|instructions)/i,
  /reveal\s+(your|the)\s+(system\s+prompt|instructions)/i,

  // Jailbreaks comunes (DAN, etc.)
  /\bDAN\b/,
  /do\s+anything\s+now/i,
  /jailbreak/i,
  /\[INST\]/i,  // Llama instruction format injection
  /<\|system\|>/i,
  /<\|user\|>/i,
  /<\|assistant\|>/i,

  // Intentos de inyectar SYSTEM/USER en español
  /ignora\s+(todas?\s+)?(las\s+)?(instrucciones?|anteriores?)/i,
  /olvida\s+(todo|lo\s+anterior|tus\s+instrucciones)/i,
  /ahora\s+eres\s+(un|una)\s+/i,
  /actúa\s+como\s+(si|un|una)\s+/i,
  /finge\s+(ser|que\s+eres)/i,
  /muestra\s+(me\s+)?(el|tu)\s+(prompt|system\s+prompt|instrucciones)/i,
  /repite\s+(el|tu)\s+(prompt|system\s+prompt|instrucciones)/i,
  /revela\s+(el|tu)\s+(prompt|instrucciones)/i,
]

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SanitizedMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SanitizeResult {
  messages: SanitizedMessage[]
  /** true si se detectó al menos un patrón de inyección */
  injectionDetected: boolean
  /** true si se truncó algún mensaje */
  truncated: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Elimina caracteres de control peligrosos del string:
 * - Null bytes (0x00)
 * - ESC (0x1B)
 * - Caracteres de control ASCII C0 (excepto tab, newline, carriage return)
 * - Caracteres de control Unicode C1 (0x80-0x9F)
 * - Zero-width characters usados en ataques Unicode invisibles
 * - RTL/LTR override characters
 */
function stripDangerousChars(input: string): string {
  return input
    // Control chars C0 (excepto \t \n \r)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x1B]/g, '')
    // Control chars C1
    .replace(/[\x80-\x9F]/g, '')
    // Zero-width and invisible Unicode
    .replace(/[​-‏‪-‮⁠-⁤﻿]/g, '')
    // Unicode tag block (used in some injection exploits)
    .replace(/[\u{E0000}-\u{E007F}]/gu, '')
    // Trim excess whitespace while preserving newlines for readability
    .replace(/[ \t]{3,}/g, '  ')
    .trim()
}

/**
 * Detecta patrones obvios de prompt injection en el contenido.
 * Retorna true si hay coincidencias.
 */
function hasInjectionPattern(content: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(content))
}

/**
 * Normaliza Unicode (NFC) para evitar ataques basados en representaciones
 * equivalentes pero visualmente idénticas.
 */
function normalizeUnicode(input: string): string {
  try {
    return input.normalize('NFC')
  } catch {
    return input
  }
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Sanitiza un arreglo de mensajes de conversación antes de enviarlos al LLM.
 *
 * Pipeline:
 * 1. Validar estructura (solo 'user'/'assistant')
 * 2. Strip de chars de control peligrosos
 * 3. Normalización Unicode NFC
 * 4. Truncar mensajes que excedan MAX_MESSAGE_CHARS
 * 5. Detectar patrones de inyección (solo en mensajes de usuario)
 * 6. Aplicar límite total de chars de conversación (truncar desde el inicio)
 * 7. Garantizar que el último mensaje sea de rol 'user'
 *
 * @param messages - Mensajes a sanitizar
 * @returns Mensajes sanitizados + flags de detección
 */
export function sanitizeMessages(messages: SanitizedMessage[]): SanitizeResult {
  let injectionDetected = false
  let truncated = false

  // Paso 1+2+3+4: limpiar y truncar cada mensaje
  let sanitized: SanitizedMessage[] = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      let content = stripDangerousChars(normalizeUnicode(m.content))

      // Paso 4: truncar si excede límite por mensaje
      if (content.length > MAX_MESSAGE_CHARS) {
        content = content.slice(0, MAX_MESSAGE_CHARS)
        truncated = true
      }

      return { role: m.role, content }
    })
    // Filtrar mensajes que quedaron vacíos después del strip
    .filter((m) => m.content.trim().length > 0)

  // Paso 5: detectar inyección en mensajes de usuario
  for (const m of sanitized) {
    if (m.role === 'user' && hasInjectionPattern(m.content)) {
      injectionDetected = true
      break
    }
  }

  // Paso 6: límite total de chars — eliminar mensajes más antiguos hasta que quepa
  let totalChars = sanitized.reduce((sum, m) => sum + m.content.length, 0)
  while (totalChars > MAX_CONVERSATION_CHARS && sanitized.length > 1) {
    const removed = sanitized.shift()!
    totalChars -= removed.content.length
    truncated = true
  }

  // Paso 7: el último mensaje debe ser de usuario (el LLM responde al usuario, no al asistente)
  while (sanitized.length > 0 && sanitized[sanitized.length - 1].role !== 'user') {
    sanitized.pop()
    truncated = true
  }

  return { messages: sanitized, injectionDetected, truncated }
}

/**
 * Sanitiza un único string de input de usuario (para herramientas, clasificador, etc.).
 */
export function sanitizeUserInput(input: string): {
  value: string
  injectionDetected: boolean
} {
  const clean = stripDangerousChars(normalizeUnicode(input))
  const truncated = clean.length > MAX_MESSAGE_CHARS
    ? clean.slice(0, MAX_MESSAGE_CHARS)
    : clean

  return {
    value: truncated,
    injectionDetected: hasInjectionPattern(truncated),
  }
}
