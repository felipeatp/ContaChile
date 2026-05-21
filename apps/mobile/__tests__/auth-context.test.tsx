import React from 'react'
import { render, act, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'

// Mocks inside factory to avoid TDZ issues with const + jest hoisting
jest.mock('../lib/auth-client', () => ({
  authClient: {
    getSession: jest.fn(),
    signOut: jest.fn(),
  },
}))

import { AuthProvider, useAuth } from '../lib/auth-context'

const { authClient } = require('../lib/auth-client') as { authClient: { getSession: jest.Mock; signOut: jest.Mock } }
const mockGetSession = authClient.getSession
const mockSignOut = authClient.signOut

function TestConsumer() {
  const { user, isLoading, refreshSession, logout } = useAuth()
  return (
    <>
      <Text testID="loading">{isLoading ? 'loading' : 'ready'}</Text>
      <Text testID="email">{user?.email ?? 'none'}</Text>
      <Text testID="name">{user?.name ?? 'no-name'}</Text>
      <Text testID="refresh" onPress={refreshSession}>refresh</Text>
      <Text testID="logout" onPress={logout}>logout</Text>
    </>
  )
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => jest.clearAllMocks())

  it('muestra el usuario de sesión cuando hay sesión activa', async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { id: 'u1', email: 'user@test.com', name: 'Felipe' } },
    })

    const { getByTestId } = renderWithProvider()
    await waitFor(() =>
      expect(getByTestId('loading').props.children).toBe('ready')
    )
    expect(getByTestId('email').props.children).toBe('user@test.com')
    expect(getByTestId('name').props.children).toBe('Felipe')
  })

  it('queda con user=null si no hay sesión activa', async () => {
    mockGetSession.mockResolvedValue({ data: null })

    const { getByTestId } = renderWithProvider()
    await waitFor(() =>
      expect(getByTestId('loading').props.children).toBe('ready')
    )
    expect(getByTestId('email').props.children).toBe('none')
  })

  it('queda con user=null si getSession lanza error', async () => {
    mockGetSession.mockRejectedValue(new Error('network error'))

    const { getByTestId } = renderWithProvider()
    await waitFor(() =>
      expect(getByTestId('loading').props.children).toBe('ready')
    )
    expect(getByTestId('email').props.children).toBe('none')
  })

  it('refreshSession actualiza el usuario en contexto', async () => {
    mockGetSession.mockResolvedValueOnce({ data: null })
    const { getByTestId } = renderWithProvider()
    await waitFor(() =>
      expect(getByTestId('loading').props.children).toBe('ready')
    )
    expect(getByTestId('email').props.children).toBe('none')

    mockGetSession.mockResolvedValueOnce({
      data: { user: { id: 'u2', email: 'google@test.com', name: 'Google User' } },
    })
    act(() => { getByTestId('refresh').props.onPress() })
    await waitFor(() =>
      expect(getByTestId('email').props.children).toBe('google@test.com')
    )
    expect(getByTestId('name').props.children).toBe('Google User')
  })

  it('refreshSession limpia el usuario si la sesión expiró', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'user@test.com', name: 'User' } },
    })
    const { getByTestId } = renderWithProvider()
    await waitFor(() => expect(getByTestId('email').props.children).toBe('user@test.com'))

    mockGetSession.mockResolvedValueOnce({ data: null })
    act(() => { getByTestId('refresh').props.onPress() })
    await waitFor(() =>
      expect(getByTestId('email').props.children).toBe('none')
    )
  })

  it('logout llama a signOut y limpia el usuario', async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { id: 'u1', email: 'user@test.com', name: null } },
    })
    mockSignOut.mockResolvedValue(undefined)

    const { getByTestId } = renderWithProvider()
    await waitFor(() => expect(getByTestId('email').props.children).toBe('user@test.com'))

    act(() => { getByTestId('logout').props.onPress() })
    await waitFor(() =>
      expect(getByTestId('email').props.children).toBe('none')
    )
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('useAuth lanza error si se usa fuera del AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within AuthProvider')
    spy.mockRestore()
  })
})
