// @vitest-environment jsdom
import type { LoadedConfig } from "@/features/config/api"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { loadOrInitDay, saveDay, saveDraft, type DayEntry } from "./api"
import { dayQuery } from "./queries"
import { useEntryAutosave } from "./useEntryAutosave"

vi.mock("./api", () => ({
  saveDay: vi.fn<typeof saveDay>(() => Promise.resolve()),
  saveDraft: vi.fn<typeof saveDraft>(),
  clearDraft: vi.fn<(date: string) => void>(),
  loadOrInitDay: vi.fn<typeof loadOrInitDay>(),
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

let queryClient: QueryClient

function loaded(unsynced: boolean) {
  queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useEntryAutosave(config, { entry: day, unsynced }), { wrapper }).result
}

describe("useEntryAutosave", () => {
  it("saves nothing when a day is loaded", () => {
    const result = loaded(false)
    act(() => {
      vi.runAllTimers()
    })
    expect(result.current.entry).toBe(day)
    expect(saveDraft).not.toHaveBeenCalled()
    expect(saveDay).not.toHaveBeenCalled()
  })

  it("drafts an edit at once and syncs it after the debounce", () => {
    const result = loaded(false)
    act(() => result.current.setEntry(withSteps(true)))
    expect(saveDraft).toHaveBeenCalledWith(withSteps(true))
    expect(saveDay).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(saveDay).toHaveBeenCalledWith(withSteps(true), config)
  })

  it("syncs a burst of edits once, with the latest value", () => {
    const result = loaded(false)
    act(() => result.current.setEntry(withSteps(true)))
    act(() => result.current.setEntry(withSteps(false)))
    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(saveDay).toHaveBeenCalledTimes(1)
    expect(saveDay).toHaveBeenCalledWith(withSteps(false), config)
  })

  it("syncs a leftover draft as soon as it loads", () => {
    loaded(true)
    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(saveDay).toHaveBeenCalledWith(day, config)
  })

  it("puts the synced entry in the day cache for other screens", async () => {
    const result = loaded(false)
    act(() => result.current.setEntry(withSteps(true)))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(queryClient.getQueryData(dayQuery(day.date).queryKey)).toEqual({
      entry: withSteps(true),
      unsynced: false,
    })
  })
})
