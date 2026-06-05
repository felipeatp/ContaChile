import { renderHook, act } from "@testing-library/react"
import { useDebounce } from "@/hooks/use-debounce"

jest.useFakeTimers()

describe("useDebounce", () => {
  it("devuelve el valor inicial de inmediato", () => {
    const { result } = renderHook(() => useDebounce("a", 300))
    expect(result.current).toBe("a")
  })

  it("retrasa la actualización hasta que pasa el delay", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebounce(v, 300),
      { initialProps: { v: "a" } }
    )
    rerender({ v: "ab" })
    expect(result.current).toBe("a")
    act(() => { jest.advanceTimersByTime(300) })
    expect(result.current).toBe("ab")
  })

  it("cancela el valor intermedio en cambios rápidos", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebounce(v, 300),
      { initialProps: { v: "a" } }
    )
    rerender({ v: "ab" })
    act(() => { jest.advanceTimersByTime(150) })
    rerender({ v: "abc" })
    act(() => { jest.advanceTimersByTime(150) })
    expect(result.current).toBe("a")
    act(() => { jest.advanceTimersByTime(150) })
    expect(result.current).toBe("abc")
  })
})
