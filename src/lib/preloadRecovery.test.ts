import { describe, expect, it, vi } from "vitest"
import { RELOAD_GUARD_MS, recoverFromPreloadError } from "./preloadRecovery"

function setup(start = 1_000_000) {
  const store = new Map<string, string>()
  let now = start
  const deps = {
    storage: () => ({
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    }),
    reload: vi.fn<() => void>(),
    now: () => now,
  }
  return { deps, advance: (ms: number) => (now += ms) }
}

const preloadError = () => new Event("vite:preloadError", { cancelable: true })

describe("recoverFromPreloadError", () => {
  it("reloads once and stops Vite from rethrowing", () => {
    const { deps } = setup()
    const event = preloadError()
    expect(recoverFromPreloadError(event, deps)).toBe(true)
    expect(deps.reload).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it("lets the error surface when it already reloaded moments ago", () => {
    const { deps, advance } = setup()
    recoverFromPreloadError(preloadError(), deps)
    advance(RELOAD_GUARD_MS - 1)
    const event = preloadError()
    expect(recoverFromPreloadError(event, deps)).toBe(false)
    expect(deps.reload).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(false)
  })

  it("reloads again once the guard window has passed", () => {
    const { deps, advance } = setup()
    recoverFromPreloadError(preloadError(), deps)
    advance(RELOAD_GUARD_MS)
    expect(recoverFromPreloadError(preloadError(), deps)).toBe(true)
    expect(deps.reload).toHaveBeenCalledTimes(2)
  })

  it("doesn't reload when storage is unavailable", () => {
    const { deps } = setup()
    const event = preloadError()
    const noStorage = {
      ...deps,
      storage: () => {
        throw new Error("SecurityError")
      },
    }
    expect(recoverFromPreloadError(event, noStorage)).toBe(false)
    expect(deps.reload).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })
})
