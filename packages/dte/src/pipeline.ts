import { getTypePlugin } from './registry'
import { validateBusinessRules } from './validators/business'
import { firmarDTE } from './signer'
import { DocumentData } from './types'

export interface PipelineResult {
  xml: string
  pdf: Buffer
}

export function runPipeline(data: DocumentData): PipelineResult {
  const plugin = getTypePlugin(data.type)
  if (!plugin) {
    throw new Error(`Document type ${data.type} not registered`)
  }

  const businessValidation = validateBusinessRules(data)
  if (!businessValidation.valid) {
    throw new Error(`Business validation failed: ${businessValidation.errors?.join(', ')}`)
  }

  const pluginValidation = plugin.validate(data)
  if (!pluginValidation.valid) {
    throw new Error(`Plugin validation failed: ${pluginValidation.errors?.join(', ')}`)
  }

  const xml = plugin.generateXML(data)
  const signedXml = firmarDTE(xml, data.company.cert)
  const pdf = plugin.generatePDF(signedXml)

  return { xml: signedXml, pdf }
}
