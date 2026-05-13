# 🧾 ContaChile — Software Contable y Tributario para Chile

> Competencia directa a Nubox, Defontana y Bsale a una fracción del costo.
> Freemium + IA integrada (Claude) como diferenciador principal.

## Estructura de este repositorio de conocimiento

```
contabl-chile/
├── README.md                    ← Este archivo (índice maestro)
├── plan/
│   ├── 01-vision.md             ← Visión, propuesta de valor, usuarios objetivo
│   ├── 02-roadmap.md            ← Fases de desarrollo (12 meses)
│   ├── 03-negocio.md            ← Modelo de negocio, precios, proyecciones
│   └── 04-stack-tecnologico.md  ← Tecnologías, arquitectura, decisiones
├── modulos/
│   ├── dte.md                   ← Módulo DTE (facturas/boletas electrónicas)
│   ├── contabilidad.md          ← Contabilidad general, libros, balances
│   ├── tributario.md            ← F29, F22, libros IVA, declaraciones
│   ├── remuneraciones.md        ← Liquidaciones, cotizaciones, DDJJ
│   └── integraciones.md         ← Fintoc, WebPay, APIs externas
├── agentes/
│   ├── 00-arquitectura-ia.md    ← Diseño general del sistema de agentes
│   ├── 01-clasificador.md       ← Agente clasificador de transacciones
│   ├── 02-f29-assistant.md      ← Agente F29 automático
│   ├── 03-consultor.md          ← Agente consultor tributario (RAG)
│   ├── 04-auditor.md            ← Agente auditor de asientos
│   └── 05-ocr.md                ← Agente OCR de documentos físicos
├── legal/
│   ├── certificacion-sii.md     ← Proceso de certificación DTE con el SII
│   ├── normativa-dte.md         ← Normas XML, esquemas XSD, tipos de documentos
│   └── datos-personales.md      ← Ley 19.628, seguridad, privacidad
└── dev/
    ├── setup.md                 ← Setup del entorno de desarrollo
    ├── db-schema.md             ← Esquema de base de datos (Prisma)
    ├── api-sii.md               ← Integración con APIs del SII
    └── testing.md               ← Estrategia de testing tributario
```

## Estado del proyecto

| Fase | Estado | Período |
|------|--------|---------|
| Fase 1 — MVP DTE | 🟡 Iniciando | Meses 1-3 |
| Fase 2 — Contabilidad completa | ⬜ Pendiente | Meses 4-6 |
| Fase 3 — Remuneraciones + Gestión | ⬜ Pendiente | Meses 7-9 |
| Fase 4 — Escala + IA avanzada | ⬜ Pendiente | Meses 10-12 |

## Acción inmediata — Semana 1

- [ ] Constituir SpA en Chile (necesario para proceso SII)
- [ ] Iniciar proceso de certificación DTE como proveedor tecnológico
- [ ] Setup repositorio GitHub + boilerplate Next.js 14 multi-tenant
- [ ] Asociarse con contador titulado para validación tributaria
- [ ] Abrir cuenta en servidor de pruebas SII (maullin.sii.cl)

## Links clave

- Portal DTE SII: https://www4.sii.cl/dte
- Servidor de pruebas: https://maullin.sii.cl
- API SII: https://apidtesii.sii.cl (documentación oficial)
- Fintoc API: https://docs.fintoc.com
