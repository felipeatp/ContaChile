import { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { apiFetch } from '../lib/api'

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const [photo, setPhoto] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const cameraRef = useRef<CameraView>(null)
  const router = useRouter()

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Permiso de cámara requerido</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Conceder permiso</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => router.back()}>
          <Text style={styles.buttonTextSecondary}>Volver</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const takePicture = async () => {
    if (!cameraRef.current) return
    const pic = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.8 })
    if (pic?.base64) {
      setPhoto(`data:image/jpeg;base64,${pic.base64}`)
      processOCR(pic.base64)
    }
  }

  const processOCR = async (base64: string) => {
    setProcessing(true)
    try {
      const data = await apiFetch('/ocr', {
        method: 'POST',
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      })
      setResult(data)
      Alert.alert('Éxito', `Documento procesado: ${data.ocr?.tipo || 'desconocido'} - Total: $${data.purchase?.totalAmount || 0}`)
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo procesar el documento')
    } finally {
      setProcessing(false)
    }
  }

  const reset = () => {
    setPhoto(null)
    setResult(null)
  }

  return (
    <View style={styles.container}>
      {!photo ? (
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.overlay}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </CameraView>
      ) : (
        <View style={styles.preview}>
          <Image source={{ uri: photo }} style={styles.image} />
          {processing && (
            <View style={styles.processing}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.processingText}>Procesando con IA...</Text>
            </View>
          )}
          {result && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Resultado OCR</Text>
              <Text style={styles.resultText}>Tipo: {result.ocr?.tipo}</Text>
              <Text style={styles.resultText}>Total: ${result.purchase?.totalAmount?.toLocaleString('es-CL')}</Text>
              <Text style={styles.resultText}>Emisor: {result.ocr?.nombreEmisor || '—'}</Text>
            </View>
          )}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.button} onPress={reset}>
              <Text style={styles.buttonText}>Nueva foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => router.back()}>
              <Text style={styles.buttonTextSecondary}>Volver</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#111',
  },
  preview: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: '90%', height: '50%', borderRadius: 12, resizeMode: 'contain' },
  processing: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  processingText: { color: '#fff', marginTop: 12, fontSize: 14 },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    margin: 16,
    width: '90%',
  },
  resultTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  resultText: { fontSize: 13, marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  button: {
    backgroundColor: '#111',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  buttonText: { color: '#fff', fontWeight: '600' },
  buttonTextSecondary: { color: '#111', fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
})
