import { registerType } from './registry'
import { generateFactura33 } from './generators/factura-33'
import { validateBusinessRules } from './validators/business'
import { DocumentData } from './types'

registerType({
  code: 33,
  name: 'Factura Electrónica',
  validate: (data: unknown) => validateBusinessRules(data as DocumentData),
  generateXML: generateFactura33,
  generatePDF: () => Buffer.from('pdf-stub'),
  requiredFields: ['receiver', 'items'],
})

export { runPipeline } from './pipeline'
export type { PipelineResult } from './pipeline'
export { registerType, getTypePlugin } from './registry'
export type { DocumentData, DocumentTypePlugin } from './types'
