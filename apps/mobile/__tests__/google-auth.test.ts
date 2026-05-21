import { Alert } from 'react-native'

jest.mock('../lib/auth-client', () => ({
  authClient: {
    signIn: {
      social: jest.fn(),
    },
  },
}))

jest.mock('../lib/config', () => ({
  CONFIG: { AUTH_BASE_URL: 'http://localhost:3000' },
}))

jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)

import { signInWithGoogle } from '../lib/google-auth'
import { authClient } from '../lib/auth-client'

const mockSocial = authClient.signIn.social as jest.Mock

describe('signInWithGoogle (flujo web/browser)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('retorna true cuando Better Auth responde sin error', async () => {
    mockSocial.mockResolvedValue({ error: null, data: {} })
    const result = await signInWithGoogle()
    expect(result).toBe(true)
    expect(mockSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/dashboard',
    })
  })

  it('retorna false y muestra alerta cuando Better Auth responde con error', async () => {
    mockSocial.mockResolvedValue({ error: { message: 'OAuth denied' } })
    const result = await signInWithGoogle()
    expect(result).toBe(false)
    expect(Alert.alert).toHaveBeenCalled()
  })

  it('retorna false y muestra alerta de red ante errores de fetch', async () => {
    mockSocial.mockRejectedValue(new Error('Network request failed'))
    const result = await signInWithGoogle()
    expect(result).toBe(false)
    const [[title]] = (Alert.alert as jest.Mock).mock.calls
    expect(title).toBe('Error de red')
  })

  it('retorna false y muestra alerta genérica ante errores desconocidos', async () => {
    mockSocial.mockRejectedValue(new Error('Unexpected server error'))
    const result = await signInWithGoogle()
    expect(result).toBe(false)
    const [[title]] = (Alert.alert as jest.Mock).mock.calls
    expect(title).toBe('Error')
  })
})
