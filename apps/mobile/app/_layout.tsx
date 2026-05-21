import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { AuthProvider } from '../lib/auth-context'
import { StatusBar } from 'expo-status-bar'
import { configureGoogleSignIn } from '../lib/google-auth-native'

export default function RootLayout() {
  useEffect(() => {
    configureGoogleSignIn()
  }, [])

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="camera" />
      </Stack>
      <StatusBar style="auto" />
    </AuthProvider>
  )
}
