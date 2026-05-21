import { Alert, Platform } from 'react-native'

// Mocks defined inside the factory to avoid TDZ issues with const + jest hoisting
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
  },
  isSuccessResponse: jest.fn(),
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}))

jest.mock('../lib/auth-client', () => ({
  authClient: {
    signIn: {
      social: jest.fn(),
    },
  },
}))

jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)

import { configureGoogleSignIn, signInWithGoogle } from '../lib/google-auth-native'
import { authClient } from '../lib/auth-client'

// Access mock references through the already-mocked module
const googleSigninMod = require('@react-native-google-signin/google-signin')
const mockConfigure = googleSigninMod.GoogleSignin.configure as jest.Mock
const mockHasPlayServices = googleSigninMod.GoogleSignin.hasPlayServices as jest.Mock
const mockSignIn = googleSigninMod.GoogleSignin.signIn as jest.Mock
const mockIsSuccessResponse = googleSigninMod.isSuccessResponse as jest.Mock
const STATUS_CODES = googleSigninMod.statusCodes

const mockSocial = (authClient.signIn.social) as jest.Mock

const MOCK_ID_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test'

describe('configureGoogleSignIn', () => {
  // Mutate process.env directly — replacing the object with = {...copy} creates a new
  // reference that may not be seen by already-compiled module code.
  const KEY = 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'
  let originalValue: string | undefined

  beforeEach(() => {
    jest.clearAllMocks()
    originalValue = process.env[KEY]
  })

  afterEach(() => {
    if (originalValue !== undefined) {
      process.env[KEY] = originalValue
    } else {
      delete process.env[KEY]
    }
  })

  it('llama a GoogleSignin.configure con webClientId del entorno', () => {
    process.env[KEY] = 'test-client-id.apps.googleusercontent.com'
    configureGoogleSignIn()
    expect(mockConfigure).toHaveBeenCalledWith(
      expect.objectContaining({ webClientId: 'test-client-id.apps.googleusercontent.com' })
    )
  })

  it('no llama a configure y emite warn si falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', () => {
    delete process.env[KEY]
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    configureGoogleSignIn()
    expect(mockConfigure).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('signInWithGoogle (flujo nativo)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true })
    mockHasPlayServices.mockResolvedValue(true)
  })

  it('retorna true cuando el flujo completo tiene éxito', async () => {
    mockIsSuccessResponse.mockReturnValue(true)
    mockSignIn.mockResolvedValue({ data: { idToken: MOCK_ID_TOKEN } })
    mockSocial.mockResolvedValue({ error: null })

    const result = await signInWithGoogle()

    expect(result).toBe(true)
    expect(mockHasPlayServices).toHaveBeenCalled()
    expect(mockSocial).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        idToken: { token: MOCK_ID_TOKEN },
      })
    )
  })

  it('retorna false sin llamar al servidor cuando isSuccessResponse es false', async () => {
    mockIsSuccessResponse.mockReturnValue(false)
    mockSignIn.mockResolvedValue({ type: 'cancelled' })

    const result = await signInWithGoogle()
    expect(result).toBe(false)
    expect(mockSocial).not.toHaveBeenCalled()
  })

  it('retorna false y muestra alerta cuando no hay idToken en la respuesta', async () => {
    mockIsSuccessResponse.mockReturnValue(true)
    mockSignIn.mockResolvedValue({ data: { idToken: null } })

    const result = await signInWithGoogle()
    expect(result).toBe(false)
    expect(Alert.alert).toHaveBeenCalled()
    expect(mockSocial).not.toHaveBeenCalled()
  })

  it('retorna false y muestra alerta cuando Better Auth responde con error', async () => {
    mockIsSuccessResponse.mockReturnValue(true)
    mockSignIn.mockResolvedValue({ data: { idToken: MOCK_ID_TOKEN } })
    mockSocial.mockResolvedValue({ error: { message: 'Invalid token' } })

    const result = await signInWithGoogle()
    expect(result).toBe(false)
    expect(Alert.alert).toHaveBeenCalled()
  })

  it('retorna false silenciosamente en SIGN_IN_CANCELLED', async () => {
    const err = new Error('cancelled')
    ;(err as any).code = STATUS_CODES.SIGN_IN_CANCELLED
    mockSignIn.mockRejectedValue(err)
    mockIsSuccessResponse.mockReturnValue(false)

    const result = await signInWithGoogle()
    expect(result).toBe(false)
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('muestra alerta cuando PLAY_SERVICES_NOT_AVAILABLE', async () => {
    const err = new Error('no play services')
    ;(err as any).code = STATUS_CODES.PLAY_SERVICES_NOT_AVAILABLE
    mockSignIn.mockRejectedValue(err)

    const result = await signInWithGoogle()
    expect(result).toBe(false)
    expect(Alert.alert).toHaveBeenCalled()
  })

  it('no llama a hasPlayServices en iOS', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true })
    mockIsSuccessResponse.mockReturnValue(true)
    mockSignIn.mockResolvedValue({ data: { idToken: MOCK_ID_TOKEN } })
    mockSocial.mockResolvedValue({ error: null })

    await signInWithGoogle()
    expect(mockHasPlayServices).not.toHaveBeenCalled()
  })
})
