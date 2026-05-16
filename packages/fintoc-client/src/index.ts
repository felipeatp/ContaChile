export interface FintocAccount {
  externalId: string
  institution: string
  holderName: string
  holderId: string
  currency: string
}

export interface FintocMovement {
  externalId: string
  postedAt: Date
  amount: number
  type: 'CREDIT' | 'DEBIT'
  description: string
  counterpartRut?: string
  counterpartName?: string
}

export interface FintocConfig {
  apiKey?: string
  baseURL?: string
  simulate?: boolean
}

export interface SimulationSeed {
  companyRut: string
  companyName: string
  matchableDtes?: Array<{
    receiverRut: string
    receiverName: string
    totalAmount: number
    emittedAt: Date
  }>
  matchablePurchases?: Array<{
    issuerRut: string
    issuerName: string
    totalAmount: number
    date: Date
  }>
}

/**
 * Cliente para integración con Fintoc. Soporta dos modos:
 * - simulate=true: genera datos sintéticos deterministas (default si FINTOC_USE_REAL !== 'true')
 * - simulate=false: llama al API real de Fintoc (https://api.fintoc.com/v1)
 */
export class FintocClient {
  private apiKey: string | undefined
  private baseURL: string
  private simulate: boolean

  constructor(config: FintocConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.FINTOC_SECRET_KEY
    this.baseURL = config.baseURL ?? process.env.FINTOC_BASE_URL ?? 'https://api.fintoc.com/v1'
    this.simulate = config.simulate ?? process.env.FINTOC_USE_REAL !== 'true'
  }

  isSimulated(): boolean {
    return this.simulate
  }

  async listAccounts(linkToken: string, seed?: SimulationSeed): Promise<FintocAccount[]> {
    if (this.simulate) return this.simulateAccounts(seed)

    const res = await this.request<{ accounts: FintocAccount[] }>(`/links/${linkToken}`)
    return res.accounts || []
  }

  async listMovements(
    linkToken: string,
    accountId: string,
    from: Date,
    to: Date,
    seed?: SimulationSeed
  ): Promise<FintocMovement[]> {
    if (this.simulate) return this.simulateMovements(from, to, seed)

    const params = new URLSearchParams({
      since: from.toISOString().slice(0, 10),
      until: to.toISOString().slice(0, 10),
    })
    const res = await this.request<{ movements: FintocMovement[] }>(
      `/links/${linkToken}/accounts/${accountId}/movements?${params}`
    )
    return res.movements || []
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.apiKey) {
      throw new Error('FINTOC_SECRET_KEY no configurada')
    }
    const res = await fetch(`${this.baseURL}${path}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      throw new Error(`Fintoc API ${res.status}: ${await res.text()}`)
    }
    return res.json() as Promise<T>
  }

  private simulateAccounts(seed?: SimulationSeed): FintocAccount[] {
    return [
      {
        externalId: 'sim_acc_001',
        institution: 'BancoSimulado',
        holderName: seed?.companyName ?? 'Empresa Simulada SpA',
        holderId: seed?.companyRut ?? '11.111.111-1',
        currency: 'CLP',
      },
    ]
  }

  private simulateMovements(from: Date, to: Date, seed?: SimulationSeed): FintocMovement[] {
    const movements: FintocMovement[] = []
    const center = new Date((from.getTime() + to.getTime()) / 2)

    // 1-2 CREDIT que matchean DTEs existentes
    const dtes = seed?.matchableDtes ?? []
    for (let i = 0; i < Math.min(2, dtes.length); i++) {
      const dte = dtes[i]
      movements.push({
        externalId: `sim_mov_dte_${i}`,
        postedAt: dte.emittedAt,
        amount: dte.totalAmount,
        type: 'CREDIT',
        description: `Transferencia de ${dte.receiverName}`,
        counterpartRut: dte.receiverRut,
        counterpartName: dte.receiverName,
      })
    }

    // 1-2 DEBIT que matchean Compras existentes
    const purchases = seed?.matchablePurchases ?? []
    for (let i = 0; i < Math.min(2, purchases.length); i++) {
      const p = purchases[i]
      movements.push({
        externalId: `sim_mov_purchase_${i}`,
        postedAt: p.date,
        amount: p.totalAmount,
        type: 'DEBIT',
        description: `Pago a ${p.issuerName}`,
        counterpartRut: p.issuerRut,
        counterpartName: p.issuerName,
      })
    }

    // Movimientos sueltos (sin match) para testear clasificación IA
    movements.push({
      externalId: 'sim_mov_misc_1',
      postedAt: center,
      amount: 45_000,
      type: 'DEBIT',
      description: 'Compra Servipag - Pago Servicios',
    })

    movements.push({
      externalId: 'sim_mov_misc_2',
      postedAt: new Date(center.getTime() + 86400000),
      amount: 120_000,
      type: 'DEBIT',
      description: 'Mantención oficina',
    })

    movements.push({
      externalId: 'sim_mov_misc_3',
      postedAt: new Date(center.getTime() - 86400000),
      amount: 25_000,
      type: 'CREDIT',
      description: 'Devolución de proveedor',
    })

    return movements
  }
}
