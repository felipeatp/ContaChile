// All mock values must be defined INSIDE the factory — importing the module happens
// before const declarations are initialized (TDZ), so closures referencing outer consts
// would fail. Access mock refs through the returned module object instead.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('@better-auth/expo/client', () => ({
  getCookie: jest.fn(),
}))

jest.mock('../lib/config', () => ({
  CONFIG: {
    API_BASE_URL: 'http://localhost:3001',
    AUTH_BASE_URL: 'http://localhost:3000',
    SCHEME: 'contachile',
  },
}))

import { apiFetch } from '../lib/api'

const SecureStoreMock = require('expo-secure-store')
const mockGetItemAsync = SecureStoreMock.getItemAsync as jest.Mock

const mockGetCookie = (require('@better-auth/expo/client') as { getCookie: jest.Mock }).getCookie

const mockFetch = jest.fn()
global.fetch = mockFetch

describe('apiFetch', () => {
  beforeEach(() => jest.clearAllMocks())

  it('incluye cookie de sesión cuando existe en SecureStore', async () => {
    mockGetItemAsync.mockResolvedValue('{"token":"abc123"}')
    mockGetCookie.mockReturnValue('session=abc123')
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })

    await apiFetch('/public/v1/company')

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('http://localhost:3001/public/v1/company')
    expect(opts.headers['Cookie']).toBe('session=abc123')
    expect(opts.headers['expo-origin']).toBe('contachile://')
    expect(opts.headers['Content-Type']).toBe('application/json')
  })

  it('omite la cookie cuando SecureStore no tiene datos', async () => {
    mockGetItemAsync.mockResolvedValue(null)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    })

    await apiFetch('/public/v1/accounting/reports')

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers['Cookie']).toBeUndefined()
    expect(opts.headers['expo-origin']).toBe('contachile://')
  })

  it('retorna el JSON parseado en respuestas 2xx', async () => {
    mockGetItemAsync.mockResolvedValue(null)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ company: { id: '1', name: 'Empresa SA' } }),
    })

    const data = await apiFetch('/public/v1/company')
    expect(data).toEqual({ company: { id: '1', name: 'Empresa SA' } })
  })

  it('lanza error con el mensaje del servidor en respuestas 4xx/5xx', async () => {
    mockGetItemAsync.mockResolvedValue(null)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    })

    await expect(apiFetch('/public/v1/company')).rejects.toThrow('Unauthorized')
  })

  it('lanza error HTTP genérico cuando el body no es JSON válido', async () => {
    mockGetItemAsync.mockResolvedValue(null)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json') },
    })

    await expect(apiFetch('/public/v1/company')).rejects.toThrow('HTTP 500')
  })

  it('fusiona headers personalizados respetando los de auth', async () => {
    mockGetItemAsync.mockResolvedValue(null)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    await apiFetch('/ruta', {
      method: 'POST',
      headers: { 'X-Custom': 'valor' },
    })

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers['X-Custom']).toBe('valor')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(opts.method).toBe('POST')
  })
})
