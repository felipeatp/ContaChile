# Arquitectura de Agentes IA — Claude Integration

## Filosofía de diseño

Los agentes no son chatbots decorativos. Cada agente resuelve un trabajo específico que hoy hace un contador humano manualmente. El objetivo es que el 80% de las tareas repetitivas sean automáticas.

## Inventario de agentes

| Agente | Modelo | Trigger | Frecuencia |
|--------|--------|---------|-----------|
| Clasificador de transacciones | claude-haiku-4-5 | Nuevos movimientos Fintoc | Diaria / en tiempo real |
| F29 Assistant | claude-sonnet-4-6 | Fin de mes / manual | Mensual |
| Consultor tributario | claude-sonnet-4-6 | Pregunta del usuario | On-demand |
| Auditor de asientos | claude-sonnet-4-6 | Manual / cierre mensual | Mensual |
| OCR de documentos | claude-sonnet-4-6 | Upload de imagen | On-demand |
| Alertas tributarias | claude-haiku-4-5 | Cron diario 08:00 | Diaria |

## Patrón de implementación (tool use)

Todos los agentes siguen el mismo patrón de tool use:

```typescript
// packages/ai-agents/src/base-agent.ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic() // API key desde env

export async function runAgent({
  systemPrompt,
  userMessage,
  tools,
  model = 'claude-haiku-4-5',
}: AgentConfig) {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage }
  ]

  while (true) {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    })

    if (response.stop_reason === 'end_turn') {
      return extractText(response.content)
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults = await executeTools(response.content)
      messages.push(
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults }
      )
    }
  }
}
```

---

## Agente 1: Clasificador de Transacciones

**Archivo:** `packages/ai-agents/src/agents/clasificador.ts`

### Qué hace
Recibe movimientos bancarios (desde Fintoc) y los clasifica en el plan de cuentas de la empresa, sugiriendo el asiento contable.

### Tools disponibles
```typescript
tools: [
  {
    name: 'get_chart_of_accounts',
    description: 'Obtiene el plan de cuentas de la empresa',
    input_schema: {
      type: 'object',
      properties: { company_id: { type: 'string' } }
    }
  },
  {
    name: 'get_transaction_history',
    description: 'Busca transacciones similares ya clasificadas para aprendizaje',
    input_schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        description_keyword: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  },
  {
    name: 'create_journal_entry',
    description: 'Crea un asiento contable con estado "sugerido" para revisión humana',
    input_schema: { /* ... */ }
  }
]
```

### System prompt
```
Eres un asistente contable especializado en empresas chilenas.
Tu tarea es clasificar movimientos bancarios en el plan de cuentas IFRS
adaptado para Chile.

Reglas:
- Siempre usa get_transaction_history para aprender de clasificaciones previas
- Si el movimiento ya fue clasificado antes con la misma descripción, usa la misma cuenta
- Para montos > $1.000.000 CLP, sugiere revisión humana obligatoria
- El estado del asiento creado siempre es "SUGERIDO", nunca "APROBADO"
- Considera que en Chile el IVA es 19%
```

---

## Agente 2: F29 Assistant

**Archivo:** `packages/ai-agents/src/agents/f29-assistant.ts`

### Qué hace
Al cierre de cada mes, analiza el libro IVA, calcula los valores del F29, detecta inconsistencias y genera un borrador con observaciones.

### Tools disponibles
```typescript
tools: [
  {
    name: 'get_sales_book',
    description: 'Obtiene el libro de ventas del período (DTEs emitidos)',
    input_schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        month: { type: 'number' },
        year: { type: 'number' }
      }
    }
  },
  {
    name: 'get_purchases_book',
    description: 'Obtiene el libro de compras del período',
    input_schema: { /* similar */ }
  },
  {
    name: 'get_previous_f29',
    description: 'Obtiene el F29 del mes anterior para comparar',
    input_schema: { /* ... */ }
  },
  {
    name: 'generate_f29_draft',
    description: 'Genera el borrador del F29 con los valores calculados',
    input_schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        codes: {
          type: 'object',
          description: 'Mapa código SII → valor. Ej: {"502": 1500000, "503": 285000}'
        },
        observations: { type: 'array', items: { type: 'string' } }
      }
    }
  }
]
```

### Códigos F29 clave que el agente maneja
```
502: Débito fiscal (IVA ventas afectas)
503: Crédito fiscal (IVA compras)
595: IVA determinado (502 - 503)
538: Remanente mes anterior
547: PPM (pago provisional mensual)
91:  Total a pagar o devolver
```

---

## Agente 3: Consultor Tributario (RAG)

**Archivo:** `packages/ai-agents/src/agents/consultor.ts`

### Qué hace
Chat integrado en la app que responde preguntas sobre normativa tributaria chilena, siempre citando la fuente legal.

### Fuentes de conocimiento (RAG)
- Código Tributario Chile (DL 830)
- Ley de IVA (DL 825)
- Circular SII N°33/2002 (DTE)
- Resoluciones SII relevantes
- Manual del Contribuyente SII
- FAQ del propio sistema (aprendido de tickets de soporte)

### Implementación RAG
```typescript
// Vectorstore: pgvector en el mismo PostgreSQL
// Embeddings: text-embedding-3-small (OpenAI) o voyage-3 (Anthropic)

tools: [
  {
    name: 'search_tax_knowledge',
    description: 'Busca en la base de conocimiento tributario chilena',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: {
          type: 'string',
          enum: ['IVA', 'Renta', 'DTE', 'Remuneraciones', 'General']
        }
      }
    }
  },
  {
    name: 'search_sii_website',
    description: 'Busca información actualizada en sii.cl',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } }
    }
  }
]
```

---

## Agente 4: Auditor de Asientos

### Qué hace
Revisa el libro diario en busca de:
- Partidas que no cuadran (debe ≠ haber)
- Asientos duplicados
- Cuentas incorrectas para el tipo de operación
- Períodos incorrectos (fecha vs. documento)
- Montos anormales vs. histórico

### Output
Informe de observaciones con severidad (Error / Advertencia / Sugerencia) y acción recomendada.

---

## Agente 5: OCR de Documentos

### Qué hace
El usuario fotografía una boleta, factura o comprobante físico. Claude analiza la imagen y extrae:
- Monto neto, IVA, total
- Fecha del documento
- RUT y nombre del proveedor
- Descripción del gasto
- Tipo de documento (boleta/factura)

Luego crea automáticamente el gasto en el sistema con estado "por aprobar".

### Prompt de visión
```
Analiza esta imagen de un documento tributario chileno.
Extrae exactamente:
1. Tipo de documento (boleta/factura/recibo)
2. Número de documento
3. Fecha (formato DD/MM/YYYY)
4. RUT del emisor (si aparece)
5. Nombre del emisor
6. Monto neto
7. IVA (19% del neto si es factura afecta)
8. Monto total
9. Descripción de lo comprado/servicio

Si algún dato no es visible, devuelve null para ese campo.
Responde SOLO en JSON, sin texto adicional.
```

---

## Costos estimados de IA por mes (100 empresas activas)

| Agente | Modelo | Tokens/mes | Costo aprox. |
|--------|--------|-----------|-------------|
| Clasificador (500 tx/empresa) | Haiku | 50M | ~$37 USD |
| F29 Assistant (1/empresa/mes) | Sonnet | 5M | ~$75 USD |
| Consultor (10 preguntas/empresa) | Sonnet | 10M | ~$150 USD |
| Auditor (1/empresa/mes) | Sonnet | 5M | ~$75 USD |
| OCR (20 docs/empresa) | Sonnet | 2M | ~$30 USD |
| **Total** | | | **~$367 USD/mes** |

Con 100 empresas Pro a 0,2 UF (~$7.500 CLP ≈ $8 USD), ingreso IA-related: $800/mes.
Margen IA positivo desde el primer mes.
