import { getTypePlugin } from './registry'
import { validateBusinessRules } from './validators/business'
import { validateXSD } from './validators/xsd'
import { firmarDTE } from './signer'
import { DocumentData } from './types'

export interface PipelineResult {
  xml: string
  pdf: Buffer
}

export async function runPipeline(data: DocumentData): Promise<PipelineResult> {
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

  const xsdValidation = validateXSD(signedXml)
  if (!xsdValidation.valid) {
    throw new Error(`XSD validation failed: ${xsdValidation.errors?.join(', ')}`)
  }

  const pdf = await plugin.generatePDF(signedXml)

  return { xml: signedXml, pdf }
}
