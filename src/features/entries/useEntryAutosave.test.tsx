// @vitest-environment jsdom
import type { LoadedConfig } from "@/features/config/api"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { configQuery } from "@/features/config/queries"
import { loadDraft, loadOrInitDay, saveDay, type DayEntry } from "./api"
import { dayQuery } from "./queries"
import { useEntryAutosave } from "./useEntryAutosave"

// The real local drafts, in jsdom's localStorage; only Postgres is mocked.
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }))
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  saveDay: vi.fn<typeof saveDay>(() => Promise.resolve()),
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
// The day after its nth edit, stamped n minutes later.
const edit = (n: number): DayEntry => ({
  ...day,
  reflection: `edit ${n}`,
  updatedAt: `2026-09-12T08:0${n}:00.000Z`,
})

// Makes the next save hang until the returned function is called.
function holdNextSave() {
  let finish = () => {}
  vi.mocked(saveDay).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = () => resolve()
    }),
  )
  return finish
}

// Makes the next read of the day hang until the returned function is called,
// then return the day as it was before any edit.
function holdNextRead() {
  let finish = () => {}
  vi.mocked(loadOrInitDay).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = () => resolve({ entry: day, unsynced: false })
    }),
  )
  return finish
}

// Runs the debounce out, and lets any finished saves settle.
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

const cachedDay = () => queryClient.getQueryData(dayQuery(day.date).queryKey)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  localStorage.clear()
})

let queryClient: QueryClient

function loaded(unsynced: boolean) {
  queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useEntryAutosave(config, { entry: day, unsynced }), { wrapper })
}

describe("useEntryAutosave", () => {
  it("saves nothing when a day is loaded", async () => {
    const { result } = loaded(false)
    await wait(800)
    expect(result.current.entry).toBe(day)
    expect(loadDraft(day.date)).toBeNull()
    expect(saveDay).not.toHaveBeenCalled()
  })

  it("drafts an edit at once and syncs it after the debounce", async () => {
    const { result } = loaded(false)
    act(() => result.current.setEntry(edit(1)))
    expect(loadDraft(day.date)).toEqual(edit(1))
    expect(saveDay).not.toHaveBeenCalled()

    await wait(800)
    expect(saveDay).toHaveBeenCalledWith(edit(1), config)
    expect(loadDraft(day.date)).toBeNull()
  })

  it("syncs a burst of edits once, with the latest value", async () => {
    const { result } = loaded(false)
    act(() => result.current.setEntry(edit(1)))
    act(() => result.current.setEntry(edit(2)))
    await wait(800)
    expect(saveDay).toHaveBeenCalledTimes(1)
    expect(saveDay).toHaveBeenCalledWith(edit(2), config)
  })

  it("syncs a leftover draft as soon as it loads", async () => {
    loaded(true)
    await wait(800)
    expect(saveDay).toHaveBeenCalledWith(day, config)
  })

  it("puts the synced entry in the day cache for other screens", async () => {
    const { result } = loaded(false)
    act(() => result.current.setEntry(edit(1)))
    expect(cachedDay()).toEqual({ entry: edit(1), unsynced: true })
    await wait(800)
    expect(cachedDay()).toEqual({ entry: edit(1), unsynced: false })
  })

  it("keeps a newer draft when an older save finishes", async () => {
    const finishFirst = holdNextSave()
    const { result } = loaded(false)
    act(() => result.current.setEntry(edit(1)))
    await wait(800)
    act(() => result.current.setEntry(edit(2)))

    finishFirst()
    await wait(0)
    expect(loadDraft(day.date)).toEqual(edit(2))
  })

  it("runs saves one at a time, so an older one can't finish last", async () => {
    const finishFirst = holdNextSave()
    const { result } = loaded(false)
    act(() => result.current.setEntry(edit(1)))
    await wait(800)
    act(() => result.current.setEntry(edit(2)))
    await wait(800)
    expect(saveDay).toHaveBeenCalledTimes(1)

    finishFirst()
    await wait(0)
    expect(saveDay).toHaveBeenCalledTimes(2)
    expect(saveDay).toHaveBeenLastCalledWith(edit(2), config)
  })

  it("sends the pending save on unmount instead of dropping it", async () => {
    const { result, unmount } = loaded(false)
    act(() => result.current.setEntry(edit(1)))
    unmount()
    await wait(0)
    expect(saveDay).toHaveBeenCalledWith(edit(1), config)
    expect(loadDraft(day.date)).toBeNull()
  })

  it("keeps the newest edit in the day cache when an older save finishes", async () => {
    const finishFirst = holdNextSave()
    const { result } = loaded(false)
    act(() => result.current.setEntry(edit(1)))
    await wait(800)
    act(() => result.current.setEntry(edit(2)))

    finishFirst()
    await wait(0)
    expect(cachedDay()).toEqual({ entry: edit(2), unsynced: true })

    await wait(800)
    expect(cachedDay()).toEqual({ entry: edit(2), unsynced: false })
  })

  it("keeps an edit in the day cache when an older read of the day lands after it", async () => {
    const { result } = loaded(false)
    queryClient.setQueryData(configQuery.queryKey, config)
    queryClient.setQueryData(dayQuery(day.date).queryKey, { entry: day, unsynced: false })
    // A background read (e.g. on window focus) starts before the edit...
    const finishRead = holdNextRead()
    const read = queryClient.fetchQuery({ ...dayQuery(day.date), staleTime: 0 })
    const finishSave = holdNextSave()
    act(() => result.current.setEntry(edit(1)))
    await wait(800)

    // ...and returns its older snapshot while the edit's save is in flight.
    finishRead()
    await act(() => read)
    expect(cachedDay()).toEqual({ entry: edit(1), unsynced: true })

    finishSave()
    await wait(0)
    expect(cachedDay()).toEqual({ entry: edit(1), unsynced: false })
  })
})
