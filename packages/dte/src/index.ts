import { registerType } from './registry'
import { generateFactura33 } from './generators/factura-33'
import { generateFactura34 } from './generators/factura-34'
import { generateBoleta39 } from './generators/boleta-39'
import { generateBoleta41 } from './generators/boleta-41'
import { generateLiquidacionFactura43 } from './generators/liquidacion-factura-43'
import { generateFacturaCompra46 } from './generators/factura-compra-46'
import { generateGuiaDespacho52 } from './generators/guia-despacho-52'
import { generateNotaDebito56 } from './generators/nota-debito-56'
import { generateNotaCredito61 } from './generators/nota-credito-61'
import { validateBusinessRules } from './validators/business'
import { renderPDF } from './pdf-renderer'
import { DocumentData } from './types'

function createPlugin(code: number, name: string, generateXML: (data: DocumentData) => string) {
  return {
    code,
    name,
    validate: (data: unknown) => validateBusinessRules(data as DocumentData),
    generateXML,
    generatePDF: (xml: string) => renderPDF(xml),
    requiredFields: ['receiver', 'items'],
  }
}

registerType(createPlugin(33, 'Factura Electrónica', generateFactura33))
registerType(createPlugin(34, 'Factura no Afecta o Exenta Electrónica', generateFactura34))
registerType(createPlugin(39, 'Boleta Electrónica', generateBoleta39))
registerType(createPlugin(41, 'Boleta no Afecta o Exenta Electrónica', generateBoleta41))
registerType(createPlugin(43, 'Liquidación-Factura Electrónica', generateLiquidacionFactura43))
registerType(createPlugin(46, 'Factura de Compra Electrónica', generateFacturaCompra46))
registerType(createPlugin(52, 'Guía de Despacho Electrónica', generateGuiaDespacho52))
registerType(createPlugin(56, 'Nota de Débito Electrónica', generateNotaDebito56))
registerType(createPlugin(61, 'Nota de Crédito Electrónica', generateNotaCredito61))

export { runPipeline } from './pipeline'
export type { PipelineResult } from './pipeline'
export { registerType, getTypePlugin } from './registry'
export type { DocumentData, DocumentTypePlugin } from './types'
export { renderPDF } from './pdf-renderer'
export { extractPrivateKeyFromPfx, firmarDTE } from './signer'
export { buildEnvioDTE } from './envio-dte'
export type { EnvioDTEData } from './envio-dte'
