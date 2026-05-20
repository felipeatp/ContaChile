import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/auth-context'
import { apiFetch, setApiKey } from '../lib/api'

export default function LoginScreen() {
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleLogin = async () => {
    if (!key.trim()) {
      Alert.alert('Error', 'Ingresa tu API key')
      return
    }

    setLoading(true)
    try {
      setApiKey(key.trim())
      await apiFetch('/public/v1/company')
      await login(key.trim())
      router.replace('/dashboard')
    } catch (err: any) {
      Alert.alert('Error', err.message || 'API key inválida')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ContaChile</Text>
      <Text style={styles.subtitle}>App Móvil</Text>

      <View style={styles.card}>
        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={styles.input}
          placeholder="ck_live_..."
          value={key}
          onChangeText={setKey}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>
          Genera tu API key desde Configuración → API Keys en la web.
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? 'Verificando...' : 'Ingresar'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
})
