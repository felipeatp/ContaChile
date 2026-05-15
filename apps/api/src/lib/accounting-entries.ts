import { prisma } from '@contachile/db'

const PUC = {
  CLIENTES: '1103',
  IVA_CREDITO: '1115',
  PROVEEDORES: '2101',
  IVA_DEBITO: '2111',
  INGRESOS_VENTAS: '4100',
  GASTOS_DIVERSOS: '5220',
}

const CATEGORY_TO_ACCOUNT_CODE: Record<string, string> = {
  personal: '5100',
  honorarios: '5101',
  arriendo: '5110',
  servicios_basicos: '5120',
  mantenimiento: '5130',
  viaje: '5140',
  marketing: '5150',
  oficina: '5160',
  seguros: '5200',
}

type Logger = { warn: (data: object, msg: string) => void }

async function findAccountIds(
  companyId: string,
  codes: string[]
): Promise<Record<string, string> | null> {
  const accounts = await prisma.account.findMany({
    where: { companyId, code: { in: codes }, isActive: true },
    select: { id: true, code: true },
  })
  const map: Record<string, string> = Object.fromEntries(accounts.map((a) => [a.code, a.id]))
  for (const code of codes) {
    if (!map[code]) return null
  }
  return map
}

export async function createSalesEntry(
  doc: {
    id: string
    companyId: string | null
    folio: number
    type: number
    totalNet: number
    totalTax: number
    totalAmount: number
    emittedAt: Date
    receiverName: string
  },
  logger?: Logger
) {
  if (!doc.companyId) {
    logger?.warn({ docId: doc.id }, 'Asiento automático omitido: documento sin companyId')
    return null
  }

  const codes = [PUC.CLIENTES, PUC.INGRESOS_VENTAS, PUC.IVA_DEBITO]
  const ids = await findAccountIds(doc.companyId, codes)
  if (!ids) {
    logger?.warn(
      { docId: doc.id, missingCodes: codes },
      'Asiento automático omitido: cuentas PUC no encontradas'
    )
    return null
  }

  return prisma.journalEntry.create({
    data: {
      companyId: doc.companyId,
      date: doc.emittedAt,
      description: `Venta DTE ${doc.type} folio ${doc.folio} - ${doc.receiverName}`,
      reference: `${doc.type}-${doc.folio}`,
      source: 'dte',
      sourceId: doc.id,
      lines: {
        create: [
          { accountId: ids[PUC.CLIENTES], debit: doc.totalAmount, credit: 0 },
          { accountId: ids[PUC.INGRESOS_VENTAS], debit: 0, credit: doc.totalNet },
          { accountId: ids[PUC.IVA_DEBITO], debit: 0, credit: doc.totalTax },
        ],
      },
    },
  })
}

export async function createPurchaseEntry(
  purchase: {
    id: string
    companyId: string
    type: number
    folio: number
    date: Date
    netAmount: number
    taxAmount: number
    totalAmount: number
    category: string | null
    issuerName: string
  },
  logger?: Logger
) {
  const gastoCode =
    (purchase.category && CATEGORY_TO_ACCOUNT_CODE[purchase.category]) || PUC.GASTOS_DIVERSOS

  const codes = [gastoCode, PUC.IVA_CREDITO, PUC.PROVEEDORES]
  const ids = await findAccountIds(purchase.companyId, codes)
  if (!ids) {
    logger?.warn(
      { purchaseId: purchase.id, missingCodes: codes },
      'Asiento automático omitido: cuentas PUC no encontradas'
    )
    return null
  }

  return prisma.journalEntry.create({
    data: {
      companyId: purchase.companyId,
      date: purchase.date,
      description: `Compra DTE ${purchase.type} folio ${purchase.folio} - ${purchase.issuerName}`,
      reference: `${purchase.type}-${purchase.folio}`,
      source: 'purchase',
      sourceId: purchase.id,
      lines: {
        create: [
          { accountId: ids[gastoCode], debit: purchase.netAmount, credit: 0 },
          { accountId: ids[PUC.IVA_CREDITO], debit: purchase.taxAmount, credit: 0 },
          { accountId: ids[PUC.PROVEEDORES], debit: 0, credit: purchase.totalAmount },
        ],
      },
    },
  })
}
