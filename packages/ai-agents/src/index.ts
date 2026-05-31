export { runAgent, streamAgent, streamAgentWithTools } from './base-agent'
export type {
  AgentConfig,
  AgentTool,
  AgentStreamConfig,
  AgentStreamConfigWithTools,
  AgentEvent,
} from './base-agent'

export { streamConsultor, runConsultorWithTools, executeConsultorTool, streamConsultorWithContext } from './agents/consultor'
export type { ConsultorMessage } from './agents/consultor'

export { clasificarTransaccion, clasificarLote } from './agents/clasificador'
export type { BankTransaction, ClassificationResult } from './agents/clasificador'

export { sanitizeMessages, sanitizeUserInput, MAX_MESSAGE_CHARS, MAX_CONVERSATION_CHARS, MAX_MESSAGES } from './sanitize'
export type { SanitizedMessage, SanitizeResult } from './sanitize'

export { buildContextSnapshot } from './context'

export { generateProactiveInsights } from './agents/insights'
export type { Insight } from './agents/insights'

export { procesarDocumentoOCR, validateOCRExtraction } from './agents/ocr'
export type { OCRResult } from './agents/ocr'
