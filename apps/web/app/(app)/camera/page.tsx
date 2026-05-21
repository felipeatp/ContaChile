'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Trash2, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface CapturedPhoto {
  id: string
  dataUrl: string
  base64: string
}

interface PhotoResult {
  photoId: string
  tipo: string
  nombreEmisor: string | null
  montoTotal: number | null
  confianza: number
  error: string | null
}

export default function CameraPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [processing, setProcessing] = useState(false)
  const [processedCount, setProcessedCount] = useState(0)
  const [results, setResults] = useState<PhotoResult[] | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraActive(true)
    } catch {
      setCameraError('No se pudo acceder a la cámara. Verifica los permisos.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }, [])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(videoRef.current, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    const base64 = dataUrl.split(',')[1]
    setPhotos(prev => [
      ...prev,
      { id: String(Date.now() + Math.random()), dataUrl, base64 },
    ])
  }, [])

  const removePhoto = useCallback((id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (photos.length === 0) return
    stopCamera()
    setProcessing(true)
    setProcessedCount(0)

    const collected = await Promise.all(
      photos.map(async (photo): Promise<PhotoResult> => {
        try {
          const res = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: photo.base64,
              mimeType: 'image/jpeg',
            }),
          })
          const data = await res.json()
          if (res.ok && data.ocr) {
            return {
              photoId: photo.id,
              tipo: data.ocr.tipo,
              nombreEmisor: data.ocr.nombreEmisor,
              montoTotal: data.ocr.montoTotal,
              confianza: data.ocr.confianza,
              error: null,
            }
          }
          return {
            photoId: photo.id,
            tipo: '',
            nombreEmisor: null,
            montoTotal: null,
            confianza: 0,
            error: data.error || 'Error al procesar',
          }
        } catch {
          return {
            photoId: photo.id,
            tipo: '',
            nombreEmisor: null,
            montoTotal: null,
            confianza: 0,
            error: 'Error de conexión',
          }
        }
      })
    )

    setProcessedCount(photos.length)
    setResults(collected)
    setProcessing(false)
  }, [photos, stopCamera])

  const formatCLP = (n: number | null) => {
    if (n === null) return '—'
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Escanear Documentos</h1>
        <p className="text-muted-foreground text-sm">
          Captura varias fotos y envíalas al OCR de una vez.
        </p>
      </div>

      {!results && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {cameraError && (
              <p className="text-sm text-destructive">{cameraError}</p>
            )}

            {!cameraActive && (
              <Button onClick={startCamera} className="w-full">
                <Camera className="mr-2 h-4 w-4" />
                Activar cámara
              </Button>
            )}

            {cameraActive && (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={capturePhoto} className="flex-1">
                    <Camera className="mr-2 h-4 w-4" />
                    Capturar
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    Detener
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!results && (
        <div className="space-y-3">
          {photos.length > 0 && (
            <>
              <p className="text-sm font-medium">
                {photos.length} foto{photos.length > 1 ? 's' : ''} capturada{photos.length > 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, idx) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.dataUrl}
                      alt={`Foto ${idx + 1}`}
                      className="w-full aspect-square object-cover rounded-md border"
                    />
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Eliminar foto ${idx + 1}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <Button
            onClick={handleSubmit}
            disabled={photos.length === 0 || processing}
            className="w-full"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando {processedCount} de {photos.length}…
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Enviar al OCR ({photos.length})
              </>
            )}
          </Button>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <p className="text-sm font-medium">
            {results.filter(r => !r.error).length} de {results.length} procesados correctamente
          </p>
          {results.map((result, idx) => (
            <Card key={result.photoId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Foto {idx + 1}</span>
                  {result.error ? (
                    <Badge variant="destructive">Error</Badge>
                  ) : (
                    <Badge variant={result.confianza >= 0.8 ? 'default' : 'secondary'}>
                      {Math.round(result.confianza * 100)}% confianza
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {result.error ? (
                  <p className="text-destructive">{result.error}</p>
                ) : (
                  <>
                    <p><span className="text-muted-foreground">Tipo:</span> {result.tipo}</p>
                    <p><span className="text-muted-foreground">Emisor:</span> {result.nombreEmisor || '—'}</p>
                    <p><span className="text-muted-foreground">Total:</span> {formatCLP(result.montoTotal)}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setResults(null); setPhotos([]) }} className="flex-1">
              Nueva captura
            </Button>
            <Button onClick={() => router.push('/purchases')} className="flex-1">
              Ver Compras
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
