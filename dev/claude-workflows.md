# Skills, Plugins y Flujos de Trabajo con Claude

## Cómo usar Claude eficientemente en este proyecto

Este documento define los flujos de trabajo óptimos con Claude para el desarrollo
de ContaChile, incluyendo qué herramientas usar en cada situación.

---

## Herramientas de Claude disponibles

### 1. Claude Code (CLI) — para desarrollo
La herramienta más importante para este proyecto.

```bash
npm install -g @anthropic-ai/claude-code
cd /path/to/contachile
claude
```

**Cuándo usarlo:**
- Generar código boilerplate (schemas, validadores, endpoints)
- Implementar algoritmos tributarios (cálculo IVA, módulo 11 RUT, etc.)
- Escribir tests unitarios
- Refactoring y revisión de código
- Leer y entender la normativa XML del SII (subir los PDFs)

**Flujo recomendado:**
```
1. Abrir claude en el directorio del proyecto
2. Darle contexto: "Estamos desarrollando un software contable para Chile"
3. Pedir tareas específicas con contexto del archivo relevante
4. Revisar y ajustar el output
```

### 2. Claude en claude.ai (este chat) — para planificación y diseño
**Cuándo usarlo:**
- Planificación de arquitectura
- Diseño de esquemas de DB
- Decisiones técnicas
- Revisión de documentos
- Generar documentación
- Preguntas sobre normativa SII

**Archivos que puedes subir aquí:**
- PDFs del SII (esquemas XSD, resoluciones, manuales técnicos)
- Documentos XML de DTE de ejemplo
- Capturas de pantalla de la interfaz SII
- CSVs de planes de cuentas

### 3. Claude API con agentes — para automatización en producción
Ya documentado en `agentes/00-arquitectura-ia.md`

---

## Prompts clave por área

### Área: Motor DTE / XML

```
Prompt tipo para Claude Code:
"Tengo el esquema XSD del SII para DTE tipo 33 [adjuntar XSD].
Implementa en TypeScript el generador de XML para este tipo de documento
usando xmlbuilder2. Incluye validación contra el XSD y manejo de errores.
El encoding debe ser ISO-8859-1 como requiere el SII."
```

### Área: Cálculos tributarios

```
Prompt tipo:
"Implementa en TypeScript las siguientes funciones tributarias chilenas:
1. calcularIVA(montoNeto: number): number  → 19%, redondeo hacia abajo
2. calcularPPM(ingresosMes: number, tasaPPM: number): number
3. calcularRetencionHonorarios(monto: number): number  → 13.75%
4. calcularCotizacionesAFP(sueldoImponible: number, tasaAFP: number): number
Incluye tests Vitest con todos los casos límite."
```

### Área: Agentes IA

```
Prompt tipo:
"Necesito implementar el agente clasificador de transacciones bancarias
para un sistema contable chileno. El agente recibe un movimiento bancario
(descripción, monto, fecha) y debe sugerir la cuenta contable correcta
del plan de cuentas IFRS adaptado a Chile.
Implementa el agente usando la API de Anthropic con tool use.
Tools necesarios: get_accounts, search_similar_transactions, create_suggestion.
Usa claude-haiku-4-5 para minimizar costo."
```

### Área: Base de datos

```
Prompt tipo:
"Diseña el schema Prisma completo para el módulo de contabilidad general
de un sistema contable chileno multi-tenant. Necesito tablas para:
- Plan de cuentas (jerárquico, importable)
- Libro diario (asientos con partida doble obligatoria)
- Períodos contables (cierre mensual/anual)
- Centros de costo
Incluye índices para las consultas más frecuentes y migraciones."
```

---

## Flujos de trabajo recomendados (semana a semana)

### Flujo semanal de desarrollo

```
Lunes: Planificación con Claude en claude.ai
  → "Esta semana voy a implementar [módulo]. ¿Cuál es el mejor approach?"
  → Definir la arquitectura y el esquema de DB

Martes-Jueves: Desarrollo con Claude Code
  → claude en el directorio del proyecto
  → Implementar feature por feature
  → Tests inmediatos

Viernes: Revisión y documentación
  → Subir código aquí para revisión de arquitectura
  → Actualizar los .md de documentación
  → Planificar semana siguiente
```

### Flujo para nueva feature tributaria

```
1. Buscar la normativa SII correspondiente (PDF)
2. Subir el PDF a este chat: "¿Cómo implemento X según esta normativa?"
3. Claude extrae los requerimientos técnicos
4. Ir a Claude Code: implementar según los requerimientos
5. Generar tests que validen contra ejemplos reales del SII
6. Actualizar el .md correspondiente en /modulos o /legal
```

---

## Contexto para pegar al inicio de conversaciones

Cuando inicies una nueva conversación en claude.ai sobre este proyecto,
pega este contexto:

```
Estoy desarrollando ContaChile, un software SaaS de contabilidad y tributaria
para Chile (competencia a Nubox/Defontana). 

Stack: Next.js 14, TypeScript, PostgreSQL/Prisma, Fastify, Claude API.
Arquitectura: monorepo con Turborepo, multi-tenant (schema-per-tenant).
Fase actual: [INDICAR FASE]

Módulos principales:
- DTE (facturas/boletas electrónicas según norma SII)
- Contabilidad general (IFRS adaptado Chile)
- F29/F22 automático
- Agentes Claude (clasificador transacciones, F29 assistant, consultor RAG)

Pregunta/tarea de hoy: [TU PREGUNTA]
```

---

## Documentos del SII que debes tener siempre a mano

Descargar y guardar localmente:

1. **Manual técnico DTE** — http://www.sii.cl/factura_electronica/factura_mercado/man_tec_dte.pdf
2. **Esquemas XSD** — Uno por cada tipo de documento (33, 39, 52, 56, 61)
3. **Resolución Ex. N°6080** — La norma base del DTE
4. **Código Tributario Chile** — Para el agente consultor RAG
5. **DL 825 (Ley IVA)** — Para validar cálculos
6. **Formato F29** — Todos los códigos y su descripción

Estos PDFs se pueden subir directamente a Claude para análisis y extracción
de información técnica.
