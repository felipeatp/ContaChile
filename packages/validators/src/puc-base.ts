export interface PucBaseAccount {
  code: string
  name: string
  type: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO'
  description?: string
}

export const PUC_BASE_ACCOUNTS: PucBaseAccount[] = [
  // ACTIVOS
  { code: '1101', name: 'Caja', type: 'ACTIVO', description: 'Efectivo en caja' },
  { code: '1102', name: 'Bancos', type: 'ACTIVO', description: 'Fondos en cuentas bancarias' },
  { code: '1103', name: 'Clientes', type: 'ACTIVO', description: 'Cuentas por cobrar' },
  { code: '1104', name: 'Documentos por cobrar', type: 'ACTIVO' },
  { code: '1110', name: 'Inventarios', type: 'ACTIVO' },
  { code: '1115', name: 'IVA Crédito Fiscal', type: 'ACTIVO', description: 'IVA pagado en compras' },

  // PASIVOS
  { code: '2101', name: 'Proveedores', type: 'PASIVO', description: 'Cuentas por pagar' },
  { code: '2102', name: 'Documentos por pagar', type: 'PASIVO' },
  { code: '2110', name: 'Impuestos por pagar', type: 'PASIVO' },
  { code: '2111', name: 'IVA Débito Fiscal', type: 'PASIVO', description: 'IVA cobrado en ventas' },
  { code: '2115', name: 'Remuneraciones por pagar', type: 'PASIVO' },

  // PATRIMONIO
  { code: '3101', name: 'Capital Social', type: 'PATRIMONIO' },
  { code: '3102', name: 'Reservas', type: 'PATRIMONIO' },
  { code: '3110', name: 'Resultado del ejercicio', type: 'PATRIMONIO' },

  // INGRESOS
  { code: '4100', name: 'Ingresos por ventas', type: 'INGRESO' },
  { code: '4101', name: 'Ingresos por servicios', type: 'INGRESO' },
  { code: '4105', name: 'Ingresos por arriendo', type: 'INGRESO' },
  { code: '4110', name: 'Ingresos diversos', type: 'INGRESO' },
  { code: '6200', name: 'Utilidad del ejercicio', type: 'INGRESO' },

  // COSTOS
  { code: '5000', name: 'Costo de ventas', type: 'COSTO' },
  { code: '5010', name: 'Costo de mercaderías', type: 'COSTO' },

  // GASTOS
  { code: '5100', name: 'Gastos de personal', type: 'GASTO', description: 'Sueldos y remuneraciones' },
  { code: '5101', name: 'Honorarios', type: 'GASTO' },
  { code: '5110', name: 'Gastos de arriendo', type: 'GASTO' },
  { code: '5120', name: 'Servicios básicos', type: 'GASTO', description: 'Luz, agua, gas, internet' },
  { code: '5130', name: 'Mantenimiento y reparaciones', type: 'GASTO' },
  { code: '5140', name: 'Gastos de viaje', type: 'GASTO' },
  { code: '5150', name: 'Gastos de marketing', type: 'GASTO' },
  { code: '5160', name: 'Gastos de oficina', type: 'GASTO' },
  { code: '5170', name: 'Depreciación', type: 'GASTO' },
  { code: '5180', name: 'Gastos financieros', type: 'GASTO', description: 'Intereses bancarios' },
  { code: '5190', name: 'Gastos legales y contables', type: 'GASTO' },
  { code: '5200', name: 'Seguros', type: 'GASTO' },
  { code: '5210', name: 'Patentes y permisos', type: 'GASTO' },
  { code: '5220', name: 'Gastos diversos', type: 'GASTO' },
  { code: '6100', name: 'Pérdida del ejercicio', type: 'GASTO' },
]
