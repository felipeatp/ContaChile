import { prisma } from '@contachile/db'
import { FintocClient, FintocMovement } from '@contachile/fintoc-client'

const MATCH_WINDOW_DAYS = 7

type Logger = { warn: (data: object, msg: string) => void }

const client = new FintocClient()

async function buildSimulationSeed(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { rut: true, name: true },
  })

  const documents = await prisma.document.findMany({
    where: { companyId, type: 33 },
    select: { receiverRut: true, receiverName: true, totalAmount: true, emittedAt: true },
    orderBy: { emittedAt: 'desc' },
    take: 5,
  })

  const purchases = await prisma.purchase.findMany({
    where: { companyId },
    select: { issuerRut: true, issuerName: true, totalAmount: true, date: true },
    orderBy: { date: 'desc' },
    take: 5,
  })

  return {
    companyRut: company?.rut ?? '11.111.111-1',
    companyName: company?.name ?? 'Empresa Simulada',
    matchableDtes: documents.map((d) => ({
      receiverRut: d.receiverRut,
      receiverName: d.receiverName,
      totalAmount: d.totalAmount,
      emittedAt: d.emittedAt,
    })),
    matchablePurchases: purchases.map((p) => ({
      issuerRut: p.issuerRut,
      issuerName: p.issuerName,
      totalAmount: p.totalAmount,
      date: p.date,
    })),
  }
}

export async function syncBankAccounts(companyId: string, logger?: Logger) {
  const seed = await buildSimulationSeed(companyId)
  const accounts = await client.listAccounts('sim_link_token', seed)

  let created = 0
  let updated = 0
  for (const acc of accounts) {
    const existing = await prisma.bankAccount.findUnique({
      where: { companyId_externalId: { companyId, externalId: acc.externalId } },
    })
    if (existing) {
      await prisma.bankAccount.update({
        where: { id: existing.id },
        data: {
          institution: acc.institution,
          holderName: acc.holderName,
          holderId: acc.holderId,
          currency: acc.currency,
        },
      })
      updated++
    } else {
      await prisma.bankAccount.create({
        data: { companyId, ...acc },
      })
      created++
    }
  }
  logger?.warn({ companyId, created, updated, simulated: client.isSimulated() }, 'syncBankAccounts')
  return { created, updated }
}

export async function syncMovements(
  companyId: string,
  bankAccountId?: string,
  from?: Date,
  to?: Date
) {
  const account = bankAccountId
    ? await prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } })
    : await prisma.bankAccount.findFirst({ where: { companyId } })

  if (!account) {
    throw new Error('No hay cuenta bancaria configurada. Ejecuta sync de cuentas primero.')
  }

  const seed = await buildSimulationSeed(companyId)
  const rangeFrom = from ?? new Date(Date.now() - 30 * 86_400_000)
  const rangeTo = to ?? new Date()

  const movements = await client.listMovements(
    'sim_link_token',
    account.externalId,
    rangeFrom,
    rangeTo,
    seed
  )

  let created = 0
  let existing = 0
  for (const m of movements) {
    const exists = await prisma.bankMovement.findUnique({
      where: { bankAccountId_externalId: { bankAccountId: account.id, externalId: m.externalId } },
    })
    if (exists) {
      existing++
      continue
    }
    await prisma.bankMovement.create({
      data: {
        companyId,
        bankAccountId: account.id,
        externalId: m.externalId,
        postedAt: m.postedAt,
        amount: m.amount,
        currency: 'CLP',
        type: m.type,
        description: m.description,
        counterpartRut: m.counterpartRut,
        counterpartName: m.counterpartName,
      },
    })
    created++
  }

  await prisma.bankAccount.update({
    where: { id: account.id },
    data: { lastSyncAt: new Date() },
  })

  return { created, existing, total: movements.length, simulated: client.isSimulated() }
}

export async function findAndApplyMatch(movementId: string, companyId: string) {
  const movement = await prisma.bankMovement.findFirst({
    where: { id: movementId, companyId },
  })
  if (!movement) throw new Error('Movimiento no encontrado')
  if (movement.status === 'RECONCILED' || movement.status === 'IGNORED') {
    return { matched: false, reason: `Movimiento ya en estado ${movement.status}` }
  }

  const windowStart = new Date(movement.postedAt.getTime() - MATCH_WINDOW_DAYS * 86_400_000)
  const windowEnd = new Date(movement.postedAt.getTime() + MATCH_WINDOW_DAYS * 86_400_000)

  if (movement.type === 'CREDIT' && movement.counterpartRut) {
    const matches = await prisma.document.findMany({
      where: {
        companyId,
        receiverRut: movement.counterpartRut,
        totalAmount: movement.amount,
        emittedAt: { gte: windowStart, lte: windowEnd },
      },
    })
    if (matches.length === 1) {
      await prisma.bankMovement.update({
        where: { id: movement.id },
        data: { status: 'MATCHED_DTE', matchedDocumentId: matches[0].id },
      })
      return { matched: true, type: 'DTE', documentId: matches[0].id }
    }
    if (matches.length > 1) {
      return { matched: false, reason: 'Múltiples DTEs candidatos', candidates: matches.map((m) => m.id) }
    }
  }

  if (movement.type === 'DEBIT' && movement.counterpartRut) {
    const matches = await prisma.purchase.findMany({
      where: {
        companyId,
        issuerRut: movement.counterpartRut,
        totalAmount: movement.amount,
        date: { gte: windowStart, lte: windowEnd },
      },
    })
    if (matches.length === 1) {
      await prisma.bankMovement.update({
        where: { id: movement.id },
        data: { status: 'MATCHED_PURCHASE', matchedPurchaseId: matches[0].id },
      })
      return { matched: true, type: 'PURCHASE', purchaseId: matches[0].id }
    }
    if (matches.length > 1) {
      return { matched: false, reason: 'Múltiples compras candidatas', candidates: matches.map((m) => m.id) }
    }
  }

  return { matched: false, reason: 'Sin candidatos' }
}

export async function reconcileWithEntry(
  movementId: string,
  companyId: string,
  debitAccountId: string,
  creditAccountId: string,
  description?: string
) {
  const movement = await prisma.bankMovement.findFirst({
    where: { id: movementId, companyId },
  })
  if (!movement) throw new Error('Movimiento no encontrado')
  if (movement.status === 'RECONCILED') throw new Error('Ya conciliado')

  const accounts = await prisma.account.findMany({
    where: { id: { in: [debitAccountId, creditAccountId] }, companyId },
    select: { id: true, isActive: true },
  })
  if (accounts.length !== 2) throw new Error('Una o más cuentas no existen')
  if (accounts.some((a) => !a.isActive)) throw new Error('Una o más cuentas inactivas')

  const desc = description || `Conciliación bancaria: ${movement.description}`

  const entry = await prisma.journalEntry.create({
    data: {
      companyId,
      date: movement.postedAt,
      description: desc,
      reference: `BANK-${movement.externalId}`,
      source: 'bank',
      sourceId: movement.id,
      lines: {
        create: [
          { accountId: debitAccountId, debit: movement.amount, credit: 0 },
          { accountId: creditAccountId, debit: 0, credit: movement.amount },
        ],
      },
    },
  })

  await prisma.bankMovement.update({
    where: { id: movement.id },
    data: { status: 'RECONCILED', journalEntryId: entry.id },
  })

  return entry
}
