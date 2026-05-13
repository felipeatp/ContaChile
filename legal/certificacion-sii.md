# Certificación SII y Normativa DTE

## ¿Por qué es crítico?

Sin la certificación del SII, el software NO puede emitir DTEs legales en Chile.
Este proceso es el cuello de botella más importante del proyecto y debe iniciarse
en la semana 1, independientemente del estado del desarrollo.

## Tipos de documentos tributarios electrónicos (DTE)

| Tipo | Código | Descripción |
|------|--------|-------------|
| Factura electrónica afecta | 33 | B2B con IVA |
| Factura electrónica exenta | 34 | B2B sin IVA |
| Liquidación factura | 43 | Comisionistas |
| Nota de débito | 56 | Aumenta monto factura |
| Nota de crédito | 61 | Anula/reduce factura |
| Boleta electrónica afecta | 39 | B2C con IVA |
| Boleta electrónica exenta | 41 | B2C sin IVA |
| Guía de despacho | 52 | Traslado de mercaderías |
| Factura de compra | 46 | Compras a emisores sin DTE |

## Estructura XML de un DTE

Cada DTE sigue este esquema (simplificado):

```xml
<?xml version="1.0" encoding="ISO-8859-1"?>
<DTE version="1.0" xmlns="http://www.sii.cl/SiiDte">
  <Documento ID="DTE-76354771-33-00000001">
    <Encabezado>
      <IdDoc>
        <TipoDTE>33</TipoDTE>
        <Folio>1</Folio>
        <FchEmis>2024-01-15</FchEmis>
        <TpoTranVenta>1</TpoTranVenta>
        <FmaPago>1</FmaPago>
      </IdDoc>
      <Emisor>
        <RUTEmisor>76354771-K</RUTEmisor>
        <RznSoc>Mi Empresa SpA</RznSoc>
        <GiroEmis>Servicios de tecnología</GiroEmis>
        <Acteco>620100</Acteco>
        <DirOrigen>Av. Providencia 123</DirOrigen>
        <CmnaOrigen>Providencia</CmnaOrigen>
        <CiudadOrigen>Santiago</CiudadOrigen>
      </Emisor>
      <Receptor>
        <RUTRecep>12345678-9</RUTRecep>
        <RznSocRecep>Cliente Ejemplo Ltda</RznSocRecep>
        <GiroRecep>Comercio al por mayor</GiroRecep>
        <DirRecep>Calle Falsa 456</DirRecep>
        <CmnaRecep>Las Condes</CmnaRecep>
        <CiudadRecep>Santiago</CiudadRecep>
      </Receptor>
      <Totales>
        <MntNeto>100000</MntNeto>
        <TasaIVA>19</TasaIVA>
        <IVA>19000</IVA>
        <MntTotal>119000</MntTotal>
      </Totales>
    </Encabezado>
    <Detalle>
      <NroLinDet>1</NroLinDet>
      <NmbItem>Servicio de desarrollo web</NmbItem>
      <QtyItem>1</QtyItem>
      <PrcItem>100000</PrcItem>
      <MontoItem>100000</MontoItem>
    </Detalle>
    <!-- TED (Timbre Electrónico) aquí -->
    <TED version="1.0">
      <!-- Datos resumidos + firma del SII (CAF) -->
    </TED>
  </Documento>
  <!-- Firma digital del emisor (xmldsig) -->
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <!-- ... -->
  </Signature>
</DTE>
```

## Proceso de certificación paso a paso

### Paso 1: Obtener folios (CAF)
1. Ingresar a www.sii.cl → Mis Documentos Tributarios → Folios
2. Solicitar folios de cada tipo de documento que se emitirá
3. Descargar el archivo CAF (XML con la firma del SII)
4. El CAF contiene el rango de folios autorizados y la clave pública del SII

### Paso 2: Ambiente de certificación
- URL: https://maullin.sii.cl (servidor de pruebas)
- Registrarse como "Software House" o proveedor tecnológico
- Obtener credenciales de prueba

### Paso 3: Set de documentos de prueba
El SII requiere que el software genere un "set de prueba" que incluye:
- Al menos 1 documento de cada tipo a certificar
- Documentos con casos especiales (descuentos, varios ítems, distintas tasas)
- DTEs que referencian otros DTEs (notas de crédito/débito)

Enviar el set a: `https://maullin.sii.cl/cgi_dte/UPL/DTEUpload`

### Paso 4: Validación
- El SII valida el XML contra sus esquemas XSD
- Valida la firma digital
- Valida el TED (timbre electrónico)
- Responde con un "trackid" para consultar el estado

### Paso 5: Obtener certificado
Si el set es aprobado, el SII emite el certificado de autorización.
El proceso completo puede tomar 30-120 días hábiles.

## Opción alternativa: Proveedor DTE puente

Mientras se completa la certificación propia, usar un proveedor certificado:

| Proveedor | API | Costo aprox. | Notas |
|-----------|-----|-------------|-------|
| Acepta.com | REST JSON | ~$4 USD/100 DTEs | API moderna, bien documentada |
| Sertigo | SOAP/REST | ~$5 USD/100 DTEs | Estable, muchos clientes |
| TokTok.cl | REST | ~$3 USD/100 DTEs | Más económico, soporte básico |
| Defontana API | REST | Variable | Solo para sus clientes |

**Recomendación:** Acepta.com para el puente — buena API y documentación.

## Implementación del TED (Timbre Electrónico del SII)

El TED es la parte más técnica del DTE. Es una firma del SII sobre los datos
resumidos del documento, que permite verificar offline la autenticidad del DTE.

```typescript
// packages/dte/src/ted.ts
interface TedData {
  RE: string   // RUT emisor
  TD: number   // Tipo DTE
  F: number    // Folio
  FE: string   // Fecha emisión
  RR: string   // RUT receptor
  RSR: string  // Razón social receptor (max 40 chars)
  MNT: number  // Monto total
  IT1: string  // Nombre primer ítem
  CAF: string  // Clave pública del CAF (XSD)
  TSTED: string // Timestamp del TED
}

export function generateTED(data: TedData, cafKey: string): string {
  // 1. Generar el XML del TED con los datos resumidos
  // 2. Firmar con la clave privada del CAF (RSA-SHA1)
  // 3. Encodear en base64
  // 4. Insertar en el DTE
}
```

## Checklist de validación de un DTE

Antes de enviar al SII, validar:

- [ ] RUT emisor válido (módulo 11 chileno)
- [ ] RUT receptor válido
- [ ] Folio dentro del rango CAF
- [ ] Fecha de emisión no futura ni > 30 días pasada
- [ ] Suma de ítems = MntNeto
- [ ] IVA = MntNeto × 0.19 (redondeo a entero)
- [ ] MntTotal = MntNeto + IVA
- [ ] XML válido contra XSD del SII
- [ ] Firma digital válida
- [ ] TED válido y con timestamp correcto
- [ ] Encoding ISO-8859-1 (no UTF-8)

## Recursos oficiales del SII

- Esquemas XSD: http://www.sii.cl/factura_electronica/factura_mercado/estructura_xml.htm
- Resolución DTE: Resolución Exenta SII N°6080 de 1999
- Manual técnico: http://www.sii.cl/factura_electronica/factura_mercado/man_tec_dte.pdf
- Portal certificación: https://www4.sii.cl/dte
- Servidor pruebas: https://maullin.sii.cl
