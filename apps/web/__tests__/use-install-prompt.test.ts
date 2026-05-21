import { renderHook, act } from '@testing-library/react'
import { useInstallPrompt } from '../lib/use-install-prompt'

function makeMockPromptEvent(promptFn = jest.fn().mockResolvedValue(undefined)) {
  const event = new Event('beforeinstallprompt') as Event & { prompt: jest.Mock }
  event.prompt = promptFn
  return event
}

describe('useInstallPrompt', () => {
  it('isInstallable es false inicialmente', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isInstallable).toBe(false)
  })

  it('isInstallable se vuelve true cuando se dispara beforeinstallprompt', () => {
    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      window.dispatchEvent(makeMockPromptEvent())
    })

    expect(result.current.isInstallable).toBe(true)
  })

  it('promptInstall llama al método prompt() del evento', async () => {
    const mockPrompt = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      window.dispatchEvent(makeMockPromptEvent(mockPrompt))
    })

    await act(async () => {
      await result.current.promptInstall()
    })

    expect(mockPrompt).toHaveBeenCalledTimes(1)
  })

  it('isInstallable vuelve a false después de llamar promptInstall', async () => {
    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      window.dispatchEvent(makeMockPromptEvent())
    })
    expect(result.current.isInstallable).toBe(true)

    await act(async () => {
      await result.current.promptInstall()
    })

    expect(result.current.isInstallable).toBe(false)
  })

  it('isInstallable vuelve a false cuando se dispara appinstalled', () => {
    const { result } = renderHook(() => useInstallPrompt())

    act(() => {
      window.dispatchEvent(makeMockPromptEvent())
    })
    expect(result.current.isInstallable).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    expect(result.current.isInstallable).toBe(false)
  })

  it('promptInstall no hace nada si no hay evento pendiente', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    await expect(result.current.promptInstall()).resolves.toBeUndefined()
  })

  it('limpia los event listeners al desmontar', () => {
    const removeEventListener = jest.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useInstallPrompt())
    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
    expect(removeEventListener).toHaveBeenCalledWith('appinstalled', expect.any(Function))
    removeEventListener.mockRestore()
  })
})
