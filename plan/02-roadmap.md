# Roadmap de Desarrollo — 12 Meses

## Resumen de fases

```
Mes:  1    2    3    4    5    6    7    8    9   10   11   12
      ├────Fase 1────┤├────Fase 2────┤├────Fase 3────┤├────Fase 4────┤
      MVP DTE        Contabilidad    Remun+Gestión    Escala+IA
```

---

## Fase 1 — MVP Tributario (Meses 1-3)

**Objetivo:** Producto que puede emitir DTE legales en Chile y preparar el F29.

**Equipo mínimo:** 1-2 developers full-stack + 1 contador asesor

### Mes 1 — Fundación

#### Infraestructura
- [x] Repositorio GitHub con monorepo (apps/web + apps/api + packages/shared)
- [x] Next.js 14 con App Router + TypeScript
- [x] PostgreSQL local Docker + Prisma ORM
- [ ] Fastify API en Railway (pendiente deploy)
- [ ] CI/CD con GitHub Actions → Vercel + Railway
- [x] Variables de entorno y secrets management

#### Auth y multi-empresa
- [x] Autenticación con Better Auth (email/password + OAuth Google)
- [x] Modelo multi-tenant: 1 usuario → N empresas (RUTs) con CompanyMembership
- [x] Schema de DB con tenant isolation
- [ ] Onboarding: crear empresa, ingresar datos SII, subir certificado digital

#### Proceso SII (iniciar en paralelo)
- [ ] Registrar cuenta en www4.sii.cl como software house
- [ ] Leer y descargar esquemas XSD del SII
- [ ] Configurar ambiente de pruebas (maullin.sii.cl)

### Mes 2 — Motor DTE

#### Librería DTE propia (packages/dte)
- [x] Generación de XML según norma SII para tipos: 33, 39, 52, 56, 61
- [x] Firma digital con certificado del usuario (xmldsig)
- [x] Generación de sobre DTE (EnvioDTE)
- [ ] Generación de set de pruebas para certificación SII
- [ ] Tests unitarios exhaustivos de cada tipo de documento

#### UI de emisión
- [x] Formulario de emisión de factura (33)
- [x] Formulario de boleta electrónica (39)
- [x] Lista de documentos emitidos con estado SII
- [x] Descarga PDF (representación impresa)
- [ ] Envío por email al cliente

### Mes 3 — Libros y F29

#### Libros tributarios
- [x] Libro de ventas automático (desde DTEs emitidos)
- [x] Ingreso manual de compras (facturas recibidas)
- [ ] Importación de compras desde XML SII (RCOF)
- [x] Libro IVA compras/ventas con cálculo automático

#### F29
- [x] Cálculo automático: IVA débito, crédito, diferencia
- [x] Vista preview del F29 con todos los códigos
- [x] Exportación a PDF para declarar manualmente
- [x] Alertas de vencimiento (día 20 de cada mes)

#### Certificación SII
- [ ] Enviar set de pruebas y obtener respuesta
- [ ] Correcciones según observaciones SII
- [ ] Certificación aprobada (si el proceso avanza rápido)

**Entregable Fase 1:** Beta privada con 10-20 usuarios reales

---

## Fase 2 — Contabilidad Completa (Meses 4-6)

**Objetivo:** Contabilidad general real, conciliación bancaria y primer agente IA.

### Mes 4 — Contabilidad General

- [x] Plan de cuentas IFRS adaptado a Chile (importable/personalizable)
- [x] Libro diario: registro de asientos manuales y automáticos
- [x] Libro mayor: movimientos por cuenta
- [x] Balance de comprobación
- [x] Estado de resultados (PyG)
- [x] Balance general
- [x] Asientos automáticos desde DTEs emitidos y recibidos

### Mes 5 — Agente IA + Conciliación Bancaria

#### Integración Fintoc
- [x] Conexión con bancos chilenos vía widget Fintoc (real + simulador dual-mode)
- [x] Importación automática de movimientos bancarios
- [x] Modelo de conciliación: movimiento bancario ↔ asiento contable + match auto DTE/Compra

#### Primer agente Claude
- [ ] Agente clasificador de transacciones (ver agentes/01-clasificador.md)
- [ ] Revisión humana de clasificaciones sugeridas
- [ ] Aprendizaje por correcciones del usuario

### Mes 6 — Pagos y Lanzamiento Beta Pública

- [ ] Integración Stripe (tarjetas internacionales)
- [ ] Integración WebPay Plus (tarjetas chilenas)
- [ ] Planes Free/Pro/Agency con límites y billing
- [ ] Dashboard de métricas del negocio (ingresos, gastos, flujo de caja)
- [ ] Lanzamiento beta pública + landing page
- [ ] Proceso de certificación SII completado (si no se completó en Fase 1)

**Entregable Fase 2:** Producto en producción con clientes pagos

---

## Fase 3 — Remuneraciones + Gestión (Meses 7-9)

**Objetivo:** Módulo de RRHH completo y herramientas de gestión.

### Mes 7 — Remuneraciones

- [x] Ficha de trabajadores (contrato, cargo, sueldo base)
- [x] Liquidaciones de sueldo según legislación chilena
- [x] Cálculo de imposiciones: AFP, salud (7%), cesantía
- [x] Descuentos legales y voluntarios
- [x] Exportación a formato PreviRed
- [ ] DDJJ 1887 (honorarios) y DDJJ 1879

### Mes 8 — Inventario y CRM

- [x] Catálogo de productos y servicios
- [x] Control de stock (entrada, salida, inventario valorado)
- [x] Ficha de clientes y proveedores con historial
- [x] Órdenes de compra y cotizaciones
- [ ] Notas de pedido → factura en 1 clic

### Mes 9 — API Pública + App Móvil

- [ ] API REST documentada (OpenAPI/Swagger)
- [ ] Webhooks para eventos (DTE enviado, pago recibido, etc.)
- [ ] App móvil React Native: captura de gastos, OCR de boletas
- [ ] Agente OCR integrado (ver agentes/05-ocr.md)

**Entregable Fase 3:** Suite completa de gestión empresarial

---

## Fase 4 — Escala y IA Avanzada (Meses 10-12)

**Objetivo:** Producto líder en automatización IA del mercado chileno.

### Mes 10 — Agentes Avanzados

- [ ] Agente consultor tributario con RAG (ver agentes/03-consultor.md)
- [ ] Agente auditor de asientos contables (ver agentes/04-auditor.md)
- [ ] F22 asistido por IA (declaración anual de renta)
- [ ] Chat contable integrado en la app

### Mes 11 — F22 y Expansión

- [ ] Módulo completo F22 con PPM acumulados
- [ ] Gastos rechazados y corrección automática
- [ ] Soporte para primera categoría y segunda categoría
- [ ] Inicio de expansión a Perú (SUNAT) o Colombia (DIAN)

### Mes 12 — Marketplace y Escala

- [ ] Marketplace de contadores certificados
- [ ] Módulo white-label para contadores (Agency plan)
- [ ] Integraciones con ERPs (SAP, Odoo)
- [ ] SOC 2 Type I (preparación para enterprise)

---

## Dependencias críticas del camino crítico

```
Certificación SII ──────────────────────────────┐
(puede tomar 2-4 meses)                          │
                                                  ▼
Setup multi-tenant ──► Motor DTE ──► Libros ──► Producción legal
```

La certificación SII es el único bloqueante que no depende del equipo de desarrollo. Iniciarla en la semana 1 es crítico.

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| Certificación SII demorada | Alta | Alto | Iniciar semana 1, tener plan B con proveedor DTE externo (Acepta, Sertigo) |
| Error en cálculo tributario | Media | Alto | Contador asesor desde el inicio, tests exhaustivos |
| Competidor lanza freemium | Media | Medio | Velocidad de ejecución, comunidad de usuarios |
| Fintoc no disponible en banco | Baja | Medio | Importación manual como fallback |
