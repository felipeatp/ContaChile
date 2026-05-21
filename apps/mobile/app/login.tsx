import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { authClient } from '../lib/auth-client'
import { useAuth } from '../lib/auth-context'
import { signInWithGoogle } from '../lib/google-auth-native'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { user, refreshSession } = useAuth()

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      const success = await signInWithGoogle()
      if (success) {
        await refreshSession()
        router.replace('/dashboard')
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo iniciar sesión con Google')
    } finally {
      setLoading(false)
    }
  }

  // Si ya hay sesión, redirigir al dashboard
  useEffect(() => {
    if (user) {
      router.replace('/dashboard')
    }
  }, [user])

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Ingresa email y contraseña')
      return
    }

    setLoading(true)
    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || '',
        })
        if (error) throw new Error(error.message || 'Error al registrarse')
        Alert.alert('Éxito', 'Cuenta creada. Ahora inicia sesión.')
        setIsSignUp(false)
      } else {
        const { error } = await authClient.signIn.email({
          email: email.trim(),
          password,
        })
        if (error) throw new Error(error.message || 'Credenciales inválidas')
        router.replace('/dashboard')
      }
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ContaChile</Text>
      <Text style={styles.subtitle}>{isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}</Text>

      <View style={styles.card}>
        {isSignUp && (
          <>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Tu nombre"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="tu@email.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? 'Cargando...' : isSignUp ? 'Crear cuenta' : 'Ingresar'}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.line} />
        </View>

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          <Text style={styles.googleButtonText}>Ingresar con Google</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.switchBtn}>
          <Text style={styles.switchText}>
            {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
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
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  switchBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchText: {
    color: '#666',
    fontSize: 13,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    color: '#666',
    fontSize: 13,
  },
  googleButton: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  googleButtonText: {
    color: '#111',
    fontWeight: '600',
    fontSize: 14,
  },
})
