// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { saveDay, saveDraft } from "@/lib/storage"
import type { DayEntry, LoadedConfig } from "@/lib/storage"
import { useEntryAutosave } from "./useEntryAutosave"

vi.mock("@/lib/storage", () => ({
  saveDay: vi.fn(() => Promise.resolve()),
  saveDraft: vi.fn(),
  clearDraft: vi.fn(),
}))

const config = {} as LoadedConfig
const day: DayEntry = {
  date: "2026-09-12",
  theme: "recovery",
  metrics: {},
  habits: { steps: false },
  reflection: "",
  updatedAt: "2026-09-12T08:00:00.000Z",
}
const withSteps = (done: boolean): DayEntry => ({ ...day, habits: { steps: done } })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

function loaded(unsynced: boolean) {
  const hook = renderHook(() => useEntryAutosave(config))
  act(() => hook.result.current.load({ entry: day, unsynced }))
  return hook.result
}

describe("useEntryAutosave", () => {
  it("saves nothing when a day is loaded", () => {
    const result = loaded(false)
    act(() => vi.runAllTimers())
    expect(result.current.entry).toBe(day)
    expect(saveDraft).not.toHaveBeenCalled()
    expect(saveDay).not.toHaveBeenCalled()
  })

  it("drafts an edit at once and syncs it after the debounce", () => {
    const result = loaded(false)
    act(() => result.current.setEntry(withSteps(true)))
    expect(saveDraft).toHaveBeenCalledWith(withSteps(true))
    expect(saveDay).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(800))
    expect(saveDay).toHaveBeenCalledWith(withSteps(true), config)
  })

  it("syncs a burst of edits once, with the latest value", () => {
    const result = loaded(false)
    act(() => result.current.setEntry(withSteps(true)))
    act(() => result.current.setEntry(withSteps(false)))
    act(() => vi.advanceTimersByTime(800))
    expect(saveDay).toHaveBeenCalledTimes(1)
    expect(saveDay).toHaveBeenCalledWith(withSteps(false), config)
  })

  it("syncs a leftover draft as soon as it loads", () => {
    loaded(true)
    act(() => vi.advanceTimersByTime(800))
    expect(saveDay).toHaveBeenCalledWith(day, config)
  })
})
