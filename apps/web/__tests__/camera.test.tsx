import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CameraPage from '../app/(app)/camera/page'

const mockStream = {
  getTracks: () => [{ stop: jest.fn() }],
}

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: jest.fn().mockResolvedValue(mockStream),
    },
    writable: true,
    configurable: true,
  })

  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    get: () => 640,
    configurable: true,
  })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    get: () => 480,
    configurable: true,
  })
  HTMLVideoElement.prototype.play = jest.fn().mockResolvedValue(undefined)

  HTMLCanvasElement.prototype.toDataURL = jest.fn(
    () => 'data:image/jpeg;base64,/9j/testdata'
  )

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      ocr: {
        tipo: 'boleta',
        numero: '1234',
        fecha: '2026-05-21',
        rutEmisor: '12345678-9',
        nombreEmisor: 'Proveedor SA',
        montoNeto: 1000,
        iva: 190,
        montoTotal: 1190,
        descripcion: 'Servicios',
        confianza: 0.95,
      },
      purchase: null,
    }),
  })
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('CameraPage', () => {
  it('muestra el botón "Activar cámara" al cargar', () => {
    render(<CameraPage />)
    expect(screen.getByRole('button', { name: /activar cámara/i })).toBeInTheDocument()
  })

  it('"Enviar al OCR" está deshabilitado cuando no hay fotos', () => {
    render(<CameraPage />)
    expect(screen.getByRole('button', { name: /enviar al ocr/i })).toBeDisabled()
  })

  it('llama a getUserMedia al hacer clic en "Activar cámara"', async () => {
    render(<CameraPage />)
    fireEvent.click(screen.getByRole('button', { name: /activar cámara/i }))
    await waitFor(() =>
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { facingMode: 'environment' },
      })
    )
  })

  it('después de activar, el botón "Capturar" aparece', async () => {
    render(<CameraPage />)
    fireEvent.click(screen.getByRole('button', { name: /activar cámara/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /capturar/i })).toBeInTheDocument()
    )
  })

  it('capturar una foto agrega una miniatura a la lista', async () => {
    render(<CameraPage />)
    fireEvent.click(screen.getByRole('button', { name: /activar cámara/i }))
    await waitFor(() => screen.getByRole('button', { name: /capturar/i }))

    fireEvent.click(screen.getByRole('button', { name: /capturar/i }))
    await waitFor(() =>
      expect(screen.getByAltText(/foto 1/i)).toBeInTheDocument()
    )
  })

  it('"Enviar al OCR" se habilita con al menos una foto', async () => {
    render(<CameraPage />)
    fireEvent.click(screen.getByRole('button', { name: /activar cámara/i }))
    await waitFor(() => screen.getByRole('button', { name: /capturar/i }))
    fireEvent.click(screen.getByRole('button', { name: /capturar/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /enviar al ocr/i })).not.toBeDisabled()
    )
  })

  it('al enviar, llama a fetch una vez por foto', async () => {
    render(<CameraPage />)
    fireEvent.click(screen.getByRole('button', { name: /activar cámara/i }))
    await waitFor(() => screen.getByRole('button', { name: /capturar/i }))
    fireEvent.click(screen.getByRole('button', { name: /capturar/i }))
    fireEvent.click(screen.getByRole('button', { name: /capturar/i }))

    await waitFor(() => screen.getByRole('button', { name: /enviar al ocr/i }))
    fireEvent.click(screen.getByRole('button', { name: /enviar al ocr/i }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledTimes(2)
    )
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ocr',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"imageBase64"'),
      })
    )
  })

  it('después de procesar, muestra los resultados', async () => {
    render(<CameraPage />)
    fireEvent.click(screen.getByRole('button', { name: /activar cámara/i }))
    await waitFor(() => screen.getByRole('button', { name: /capturar/i }))
    fireEvent.click(screen.getByRole('button', { name: /capturar/i }))

    await waitFor(() => screen.getByRole('button', { name: /enviar al ocr/i }))
    fireEvent.click(screen.getByRole('button', { name: /enviar al ocr/i }))

    await waitFor(() =>
      expect(screen.getByText(/proveedor sa/i)).toBeInTheDocument()
    )
  })
})
