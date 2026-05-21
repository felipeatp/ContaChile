describe('CONFIG', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('usa valores por defecto cuando no hay variables de entorno', () => {
    delete process.env.EXPO_PUBLIC_AUTH_BASE_URL
    delete process.env.EXPO_PUBLIC_API_BASE_URL

    const { CONFIG } = require('../lib/config')
    expect(CONFIG.AUTH_BASE_URL).toBe('http://localhost:3000')
    expect(CONFIG.API_BASE_URL).toBe('http://localhost:3001')
    expect(CONFIG.SCHEME).toBe('contachile')
  })

  it('usa las variables de entorno cuando están definidas', () => {
    process.env.EXPO_PUBLIC_AUTH_BASE_URL = 'http://192.168.1.100:3000'
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://192.168.1.100:3001'

    const { CONFIG } = require('../lib/config')
    expect(CONFIG.AUTH_BASE_URL).toBe('http://192.168.1.100:3000')
    expect(CONFIG.API_BASE_URL).toBe('http://192.168.1.100:3001')
  })

  it('getDebugInfo retorna las URLs actuales', () => {
    const { CONFIG, getDebugInfo } = require('../lib/config')
    const info = getDebugInfo()
    expect(info.authUrl).toBe(CONFIG.AUTH_BASE_URL)
    expect(info.apiUrl).toBe(CONFIG.API_BASE_URL)
    expect(info).toHaveProperty('isEmulator')
  })
})
