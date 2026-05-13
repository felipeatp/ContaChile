import { DocumentTypePlugin } from './types'

const plugins = new Map<number, DocumentTypePlugin>()

export function registerType(plugin: DocumentTypePlugin): void {
  plugins.set(plugin.code, plugin)
}

export function getTypePlugin(code: number): DocumentTypePlugin | null {
  return plugins.get(code) ?? null
}
