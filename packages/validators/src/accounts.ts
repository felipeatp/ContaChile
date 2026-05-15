export interface PucAccount {
  code: string
  name: string
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'
  description: string
}

export const PUC_BASE_ACCOUNTS: PucAccount[] = [
  // ACTIVO (1)
  { code: '1.1.10.10', name: 'Caja', type: 'ASSET', description: 'Efectivo en caja' },
  { code: '1.1.10.20', name: 'Bancos', type: 'ASSET', description: 'Fondos en cuentas bancarias' },
  { code: '1.1.20.10', name: 'Clientes', type: 'ASSET', description: 'Cuentas por cobrar a clientes' },
  { code: '1.1.20.20', name: 'Documentos por Cobrar', type: 'ASSET', description: 'Documentos por cobrar' },
  { code: '1.1.30.10', name: 'Inventarios', type: 'ASSET', description: 'Mercaderías e inventarios' },
  { code: '1.2.10.10', name: 'Inmuebles', type: 'ASSET', description: 'Propiedades inmuebles' },
  { code: '1.2.10.20', name: 'Maquinaria y Equipos', type: 'ASSET', description: 'Maquinaria y equipos' },
  { code: '1.2.10.30', name: 'Muebles y Utiles', type: 'ASSET', description: 'Muebles y útiles de oficina' },
  { code: '1.2.20.10', name: 'Depreciación Acumulada', type: 'ASSET', description: 'Depreciación acumulada de activos fijos' },

  // PASIVO (2)
  { code: '2.1.10.10', name: 'Proveedores', type: 'LIABILITY', description: 'Cuentas por pagar a proveedores' },
  { code: '2.1.10.20', name: 'Documentos por Pagar', type: 'LIABILITY', description: 'Documentos por pagar' },
  { code: '2.1.20.10', name: 'Impuestos por Pagar', type: 'LIABILITY', description: 'Impuestos por pagar' },
  { code: '2.1.20.20', name: 'IVA Débito', type: 'LIABILITY', description: 'IVA débito fiscal' },
  { code: '2.1.20.30', name: 'IVA Crédito', type: 'LIABILITY', description: 'IVA crédito fiscal' },
  { code: '2.1.30.10', name: 'Remuneraciones por Pagar', type: 'LIABILITY', description: 'Sueldos y remuneraciones por pagar' },
  { code: '2.2.10.10', name: 'Obligaciones Bancarias', type: 'LIABILITY', description: 'Préstamos y obligaciones con bancos' },

  // PATRIMONIO (3)
  { code: '3.1.10.10', name: 'Capital Social', type: 'EQUITY', description: 'Capital aportado por los socios' },
  { code: '3.1.20.10', name: 'Reservas', type: 'EQUITY', description: 'Reservas de la empresa' },
  { code: '3.2.10.10', name: 'Utilidades del Ejercicio', type: 'EQUITY', description: 'Ganancias del período actual' },
  { code: '3.2.20.10', name: 'Pérdidas del Ejercicio', type: 'EQUITY', description: 'Pérdidas del período actual' },

  // INGRESOS (4)
  { code: '4.1.10.10', name: 'Ventas', type: 'INCOME', description: 'Ingresos por ventas de bienes' },
  { code: '4.1.10.20', name: 'Servicios', type: 'INCOME', description: 'Ingresos por prestación de servicios' },
  { code: '4.1.20.10', name: 'Ventas Exentas', type: 'INCOME', description: 'Ventas exentas de IVA' },
  { code: '4.2.10.10', name: 'Intereses Ganados', type: 'INCOME', description: 'Ingresos por intereses' },
  { code: '4.2.10.20', name: 'Otros Ingresos', type: 'INCOME', description: 'Otros ingresos no operacionales' },

  // EGRESOS / COSTOS (5)
  { code: '5.1.10.10', name: 'Costo de Ventas', type: 'EXPENSE', description: 'Costo de mercaderías vendidas' },
  { code: '5.2.10.10', name: 'Gastos de Administración', type: 'EXPENSE', description: 'Gastos administrativos generales' },
  { code: '5.2.10.20', name: 'Gastos de Personal', type: 'EXPENSE', description: 'Sueldos, salarios y cargas sociales' },
  { code: '5.2.10.30', name: 'Arriendos', type: 'EXPENSE', description: 'Gastos por arriendo de inmuebles' },
  { code: '5.2.10.40', name: 'Servicios Básicos', type: 'EXPENSE', description: 'Luz, agua, teléfono, internet' },
  { code: '5.2.20.10', name: 'Gastos de Ventas', type: 'EXPENSE', description: 'Gastos de comercialización' },
  { code: '5.2.30.10', name: 'Depreciación', type: 'EXPENSE', description: 'Depreciación del período' },
  { code: '5.3.10.10', name: 'Gastos Financieros', type: 'EXPENSE', description: 'Intereses y gastos bancarios' },
  { code: '5.3.10.20', name: 'Otros Gastos', type: 'EXPENSE', description: 'Otros gastos no operacionales' },
]
