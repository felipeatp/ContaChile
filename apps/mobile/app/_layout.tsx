import { Stack } from 'expo-router'
import { AuthProvider } from '../lib/auth-context'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
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
