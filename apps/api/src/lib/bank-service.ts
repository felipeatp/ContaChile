import { prisma } from '@contachile/db'
import { FintocClient, FintocMovement, SimulationSeed } from '@contachile/fintoc-client'

const MATCH_WINDOW_DAYS = 7

type Logger = { warn: (data: object, msg: string) => void }

const realClient = new FintocClient({ simulate: false })
const simClient = new FintocClient({ simulate: true })

function getClient(isReal: boolean) {
  return isReal ? realClient : simClient
}

const FINTOC_API_KEY = process.env.FINTOC_SECRET_KEY || ''
const FINTOC_BASE_URL = process.env.FINTOC_BASE_URL || 'https://api.fintoc.com/v1'

async function fintocRequest<T>(path: string, body?: object): Promise<T> {
  if (!FINTOC_API_KEY) throw new Error('FINTOC_SECRET_KEY no configurada')
  const res = await fetch(`${FINTOC_BASE_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${FINTOC_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(body && { body: JSON.stringify(body) }),
  })
  if (!res.ok) {
    throw new Error(`Fintoc API ${res.status}: ${await res.text()}`)
  }
  return res.json() as Promise<T>
}

async function buildSimulationSeed(companyId: string): Promise<SimulationSeed> {
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

// ── Account helpers ──

async function upsertAccounts(
  companyId: string,
  accounts: { externalId: string; institution: string; holderName: string; holderId: string; currency: string }[],
  mode: 'REAL' | 'SIMULATED' | 'DEMO',
  fintocLinkId?: string
) {
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
          mode,
          ...(fintocLinkId && { fintocLinkId }),
        },
      })
      updated++
    } else {
      await prisma.bankAccount.create({
        data: { companyId, ...acc, mode, fintocLinkId: fintocLinkId ?? null },
      })
      created++
    }
  }
  return { created, updated }
}

// ── Public API ──

export async function createLinkIntent(holderType: 'individual' | 'business' = 'business') {
  const intent = await fintocRequest<{
    id: string
    widget_token: string
    status: string
  }>('/link_intents', {
    holder_type: holderType,
    product: 'movements',
    country: 'cl',
  })
  return { widgetToken: intent.widget_token, intentId: intent.id }
}

export async function exchangeLinkToken(exchangeToken: string) {
  const result = await fintocRequest<{
    link_token: string
    link: {
      id: string
      institution: { id: string; name: string }
      accounts: Array<{
        id: string
        name: string
        type: string
        number: string
        balance: { available: number; current: number }
        currency: string
        holder_id: string
        holder_name: string
      }>
    }
  }>('/link_intents/exchange', { exchange_token: exchangeToken })

  const accounts = result.link.accounts.map((a) => ({
    externalId: a.id,
    institution: result.link.institution.name,
    holderName: a.holder_name || result.link.institution.name,
    holderId: a.holder_id || '',
    currency: a.currency || 'CLP',
  }))

  return {
    linkToken: result.link_token,
    accounts,
  }
}

export async function connectBankLink(companyId: string, linkToken: string) {
  const client = getClient(true)
  const accounts = await client.listAccounts(linkToken)

  const { created, updated } = await upsertAccounts(companyId, accounts, 'REAL', linkToken)

  return {
    created,
    updated,
    accounts: accounts.map((a) => a.externalId),
    mode: 'REAL',
  }
}

export async function syncBankAccounts(companyId: string, logger?: Logger) {
  const realAccounts = await prisma.bankAccount.findMany({
    where: { companyId, mode: 'REAL' },
  })

  // If there are real accounts, sync each one with Fintoc API
  if (realAccounts.length > 0) {
    let totalCreated = 0
    let totalUpdated = 0
    for (const acc of realAccounts) {
      if (!acc.fintocLinkId) continue
      const client = getClient(true)
      const accounts = await client.listAccounts(acc.fintocLinkId)
      const { created, updated } = await upsertAccounts(companyId, accounts, 'REAL', acc.fintocLinkId)
      totalCreated += created
      totalUpdated += updated
    }
    logger?.warn({ companyId, created: totalCreated, updated: totalUpdated, mode: 'REAL' }, 'syncBankAccounts')
    return { created: totalCreated, updated: totalUpdated, mode: 'REAL' }
  }

  // Fallback to simulator
  const seed = await buildSimulationSeed(companyId)
  const accounts = await simClient.listAccounts('sim_link_token', seed)
  const { created, updated } = await upsertAccounts(companyId, accounts, 'SIMULATED')
  logger?.warn({ companyId, created, updated, mode: 'SIMULATED' }, 'syncBankAccounts')
  return { created, updated, mode: 'SIMULATED' }
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

  const rangeFrom = from ?? new Date(Date.now() - 30 * 86_400_000)
  const rangeTo = to ?? new Date()

  let movements: FintocMovement[]

  if (account.mode === 'REAL' && account.fintocLinkId) {
    const client = getClient(true)
    movements = await client.listMovements(
      account.fintocLinkId,
      account.externalId,
      rangeFrom,
      rangeTo
    )
  } else {
    const seed = await buildSimulationSeed(companyId)
    movements = await simClient.listMovements(
      'sim_link_token',
      account.externalId,
      rangeFrom,
      rangeTo,
      seed
    )
  }

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

  return {
    created,
    existing,
    total: movements.length,
    mode: account.mode,
  }
}

export async function setAccountMode(
  accountId: string,
  companyId: string,
  mode: 'REAL' | 'SIMULATED' | 'DEMO',
  linkToken?: string
) {
  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, companyId },
  })
  if (!account) throw new Error('Cuenta no encontrada')

  const data: { mode: 'REAL' | 'SIMULATED' | 'DEMO'; fintocLinkId?: string | null } = { mode }

  if (mode === 'REAL') {
    if (!linkToken && !account.fintocLinkId) {
      throw new Error('Se requiere un link token para modo REAL')
    }
    if (linkToken) data.fintocLinkId = linkToken
  } else {
    data.fintocLinkId = null
  }

  await prisma.bankAccount.update({ where: { id: accountId }, data })
  return { success: true, mode }
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

  const accounts = await prisma.ledgerAccount.findMany({
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
