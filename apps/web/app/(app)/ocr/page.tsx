'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Camera, Upload, RotateCcw, CheckCircle, AlertTriangle, Loader2, FileText, XCircle } from 'lucide-react'

interface OCRResult {
  tipo: string
  numero: string | null
  fecha: string | null
  rutEmisor: string | null
  nombreEmisor: string | null
  montoNeto: number | null
  iva: number | null
  montoTotal: number | null
  descripcion: string | null
  confianza: number
}

interface PurchaseResult {
  id: string
  type: number
  folio: number
  date: Date
  issuerName: string
  totalAmount: number
  status: string
}

export default function OCRPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [image, setImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null)
  const [purchase, setPurchase] = useState<PurchaseResult | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Solo se permiten imágenes')
      return
    }
    setErrorMsg(null)
    const reader = new FileReader()
    reader.onloadend = () => setImage(reader.result as string)
    reader.readAsDataURL(file)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setStream(s)
      setCameraActive(true)
      if (videoRef.current) {
        videoRef.current.srcObject = s
      }
    } catch {
      setErrorMsg('No se pudo acceder a la cámara')
    }
  }, [])

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop())
    setStream(null)
    setCameraActive(false)
  }, [stream])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(videoRef.current, 0, 0)
    setImage(canvas.toDataURL('image/jpeg', 0.9))
    stopCamera()
  }, [stopCamera])

  const processOCR = useCallback(async () => {
    if (!image) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: image.split(',')[1], mimeType: image.split(';')[0].split(':')[1] }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Error al procesar documento')
        if (data.ocr) setOcrResult(data.ocr)
        return
      }
      setOcrResult(data.ocr)
      setPurchase(data.purchase)
    } catch {
      setErrorMsg('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [image])

  const reset = useCallback(() => {
    setImage(null)
    setOcrResult(null)
    setPurchase(null)
    setErrorMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const formatCurrency = (n: number | null) => {
    if (n === null) return '—'
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">OCR IA de Documentos</h1>
        <p className="text-muted-foreground">Fotografía boletas o facturas y la IA los clasificará automáticamente.</p>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-red-800 text-sm border border-red-200">
          <XCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Capturar Documento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!image && !cameraActive && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={startCamera} className="flex-1">
                <Camera className="mr-2 h-4 w-4" />
                Usar Cámara
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1">
                <Upload className="mr-2 h-4 w-4" />
                Subir Imagen
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {cameraActive && (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              </div>
              <div className="flex gap-3">
                <Button onClick={capturePhoto} className="flex-1">
                  <Camera className="mr-2 h-4 w-4" />
                  Capturar
                </Button>
                <Button variant="outline" onClick={stopCamera}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {image && !cameraActive && (
            <div className="space-y-3">
              <div className="rounded-lg overflow-hidden border">
                <img src={image} alt="Documento capturado" className="w-full max-h-[400px] object-contain" />
              </div>
              <div className="flex gap-3">
                <Button onClick={processOCR} disabled={loading} className="flex-1">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  {loading ? 'Procesando con IA...' : 'Procesar Documento'}
                </Button>
                <Button variant="outline" onClick={reset} disabled={loading}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Nueva Foto
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {ocrResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Resultado OCR
              </span>
              <Badge variant={ocrResult.confianza >= 0.8 ? 'default' : ocrResult.confianza >= 0.5 ? 'secondary' : 'destructive'}>
                Confianza: {Math.round(ocrResult.confianza * 100)}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Tipo</label>
                <p className="font-medium capitalize">{ocrResult.tipo}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Número</label>
                <p className="font-medium">{ocrResult.numero || '—'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Fecha</label>
                <p className="font-medium">{ocrResult.fecha || '—'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">RUT Emisor</label>
                <p className="font-medium">{ocrResult.rutEmisor || '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Nombre Emisor</label>
                <p className="font-medium">{ocrResult.nombreEmisor || '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Descripción</label>
                <p className="font-medium">{ocrResult.descripcion || '—'}</p>
              </div>
            </div>

            <hr className="border-t" />

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Neto</label>
                <p className="font-medium">{formatCurrency(ocrResult.montoNeto)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">IVA</label>
                <p className="font-medium">{formatCurrency(ocrResult.iva)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Total</label>
                <p className="font-bold text-lg">{formatCurrency(ocrResult.montoTotal)}</p>
              </div>
            </div>

            {ocrResult.confianza < 0.7 && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-amber-800 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>La confianza del OCR es baja. Revisa los datos antes de aprobar.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {purchase && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              Compra Creada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-green-800">
              El documento fue registrado como compra pendiente de aprobación.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Folio:</span>{' '}
                <span className="font-medium">{purchase.folio || 'S/N'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Emisor:</span>{' '}
                <span className="font-medium">{purchase.issuerName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total:</span>{' '}
                <span className="font-medium">{formatCurrency(purchase.totalAmount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Estado:</span>{' '}
                <Badge variant="outline">Pendiente de aprobación</Badge>
              </div>
            </div>
            <div className="pt-2">
              <Button variant="outline" onClick={() => router.push('/purchases')}>
                <FileText className="mr-2 h-4 w-4" />
                Ver Compras
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
