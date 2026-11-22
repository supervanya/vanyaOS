// @vitest-environment jsdom
import type { LoadedConfig } from "@/features/config/api"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { configQuery } from "@/features/config/queries"
import { getSaveState } from "@/lib/saveStatus"
import { toast } from "sonner"
import type { Metric } from "@/lib/config"
import {
  loadDraft,
  loadMorningDraft,
  loadOrInitDay,
  saveDay,
  saveMorning,
  type DayEntry,
  type LoadedDay,
  type LoadedMorning,
  type MorningEntry,
} from "./api"
import { dayQuery, morningQuery } from "./queries"
import { useEntryAutosave, useMorningAutosave } from "./useEntryAutosave"

// The real local drafts, in jsdom's localStorage; only Postgres is mocked.
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }))
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  saveDay: vi.fn<typeof saveDay>(() => Promise.resolve()),
  saveMorning: vi.fn<typeof saveMorning>(() => Promise.resolve()),
  loadOrInitDay: vi.fn<typeof loadOrInitDay>(),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn<(message: string) => void>() } }))

// One metric per half: mood is asked at night, sleep in the morning.
const metric = (id: string, timing: Metric["timing"]): Metric => ({
  id,
  label: id,
  group: "Core",
  higherIsBetter: true,
  scale: 5,
  timing,
})
const config: LoadedConfig = {
  activeTheme: "recovery",
  themes: ["recovery"],
  metrics: [metric("mood", "evening"), metric("sleep", "morning")],
  habits: [],
  goals: [],
  metricRowId: {},
  habitRowId: {},
}
const day: DayEntry = {
  date: "2026-09-12",
  theme: "recovery",
  metrics: {},
  habits: { steps: false },
  reflection: "",
  intention: "",
  intentionLived: null,
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
      finish = () => resolve({ entry: day, synced: [day] })
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

afterEach(async () => {
  // Unmounting sends any sync still on the debounce; let it land so it doesn't
  // leave the app-wide save state "saving" for the next test.
  cleanup()
  await wait(0)
  vi.useRealTimers()
  vi.clearAllMocks()
  localStorage.clear()
})

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

// The day as a screen opens it, from the cache: Postgres holds it, unless
// `synced` says otherwise.
function loaded(synced: LoadedDay["synced"] = [day]) {
  queryClient = new QueryClient()
  const start = { entry: day, synced }
  queryClient.setQueryData(dayQuery(day.date).queryKey, start)
  return renderHook(() => useEntryAutosave(config, start), { wrapper })
}

describe("useEntryAutosave", () => {
  it("saves nothing when a day is loaded", async () => {
    const { result } = loaded()
    await wait(800)
    expect(result.current.entry).toBe(day)
    expect(loadDraft(day.date)).toBeNull()
    expect(saveDay).not.toHaveBeenCalled()
  })

  it("drafts an edit at once and syncs it after the debounce", async () => {
    const { result } = loaded()
    act(() => result.current.setEntry(edit(1)))
    expect(loadDraft(day.date)).toEqual(edit(1))
    expect(saveDay).not.toHaveBeenCalled()

    await wait(800)
    // Sent with the day as loaded, to send only what changed since.
    expect(saveDay).toHaveBeenCalledWith(edit(1), config, [day])
    expect(loadDraft(day.date)).toBeNull()
  })

  it("syncs a burst of edits once, with the latest value", async () => {
    const { result } = loaded()
    act(() => result.current.setEntry(edit(1)))
    act(() => result.current.setEntry(edit(2)))
    await wait(800)
    expect(saveDay).toHaveBeenCalledTimes(1)
    expect(saveDay).toHaveBeenCalledWith(edit(2), config, [day])
  })

  it("syncs a leftover draft as soon as it loads, measured from the day as saved", async () => {
    const saved = { ...day, reflection: "saved" }
    loaded([saved])
    await wait(800)
    expect(saveDay).toHaveBeenCalledWith(day, config, [saved])
  })

  it("takes over an edit from a screen left mid-save, without sending it all again", async () => {
    const finishFirst = holdNextSave()
    const { result, unmount } = loaded()
    act(() => result.current.setEntry(edit(1)))
    unmount() // e.g. /reflect → the dashboard, before the save lands
    const next = cachedDay()
    expect(next).toEqual({ entry: edit(1), synced: [day] })
    if (!next) return
    renderHook(() => useEntryAutosave(config, next), { wrapper })

    finishFirst()
    await wait(800)
    // Measured from what the first save confirmed: nothing left to send.
    expect(saveDay).toHaveBeenCalledTimes(2)
    expect(saveDay).toHaveBeenLastCalledWith(edit(1), config, [edit(1)])
  })

  it("puts the synced entry in the day cache for other screens", async () => {
    const { result } = loaded()
    act(() => result.current.setEntry(edit(1)))
    expect(cachedDay()).toEqual({ entry: edit(1), synced: [day] })
    await wait(800)
    expect(cachedDay()).toEqual({ entry: edit(1), synced: [edit(1)] })
  })

  it("keeps a newer draft when an older save finishes", async () => {
    const finishFirst = holdNextSave()
    const { result } = loaded()
    act(() => result.current.setEntry(edit(1)))
    await wait(800)
    act(() => result.current.setEntry(edit(2)))

    finishFirst()
    await wait(0)
    expect(loadDraft(day.date)).toEqual(edit(2))
  })

  it("runs saves one at a time, so an older one can't finish last", async () => {
    const finishFirst = holdNextSave()
    const { result } = loaded()
    act(() => result.current.setEntry(edit(1)))
    await wait(800)
    act(() => result.current.setEntry(edit(2)))
    await wait(800)
    expect(saveDay).toHaveBeenCalledTimes(1)

    finishFirst()
    await wait(0)
    expect(saveDay).toHaveBeenCalledTimes(2)
    expect(saveDay).toHaveBeenLastCalledWith(edit(2), config, [edit(1)])
  })

  it("sends the pending save on unmount instead of dropping it", async () => {
    const { result, unmount } = loaded()
    act(() => result.current.setEntry(edit(1)))
    unmount()
    await wait(0)
    expect(saveDay).toHaveBeenCalledWith(edit(1), config, [day])
    expect(loadDraft(day.date)).toBeNull()
  })

  it("keeps the newest edit in the day cache when an older save finishes", async () => {
    const finishFirst = holdNextSave()
    const { result } = loaded()
    act(() => result.current.setEntry(edit(1)))
    await wait(800)
    act(() => result.current.setEntry(edit(2)))

    finishFirst()
    await wait(0)
    expect(cachedDay()).toEqual({ entry: edit(2), synced: [edit(1)] })

    await wait(800)
    expect(cachedDay()).toEqual({ entry: edit(2), synced: [edit(2)] })
  })

  it("keeps an edit in the day cache when an older read of the day lands after it", async () => {
    const { result } = loaded()
    queryClient.setQueryData(configQuery.queryKey, config)
    // A background read (e.g. on window focus) starts before the edit...
    const finishRead = holdNextRead()
    const read = queryClient.fetchQuery({ ...dayQuery(day.date), staleTime: 0 })
    const finishSave = holdNextSave()
    act(() => result.current.setEntry(edit(1)))
    await wait(800)

    // ...and returns its older snapshot while the edit's save is in flight.
    finishRead()
    await act(() => read)
    expect(cachedDay()).toEqual({ entry: edit(1), synced: [day] })

    finishSave()
    await wait(0)
    expect(cachedDay()).toEqual({ entry: edit(1), synced: [edit(1)] })
  })

  it("shows the edit as saving from the first keystroke until its sync lands", async () => {
    const finishSave = holdNextSave()
    const { result } = loaded()
    act(() => result.current.setEntry(edit(1)))
    expect(getSaveState()).toBe("saving")
    await wait(800)
    expect(getSaveState()).toBe("saving")
    finishSave()
    await wait(0)
    expect(getSaveState()).toBe("saved")
  })

  it("shows the edit as not synced when its sync fails", async () => {
    vi.mocked(saveDay).mockRejectedValueOnce(new Error("offline"))
    const { result } = loaded()
    act(() => result.current.setEntry(edit(1)))
    await wait(800)
    expect(getSaveState()).toBe("failed")
  })

  it("sends a failed edit again with the next one", async () => {
    vi.mocked(saveDay).mockRejectedValueOnce(new Error("offline"))
    const { result } = loaded()
    act(() => result.current.setEntry(edit(1)))
    await wait(800)
    act(() => result.current.setEntry(edit(2)))
    await wait(800)
    // Edit 1 may have landed with its answer lost: measured from both, so
    // whatever it changed goes again.
    expect(saveDay).toHaveBeenLastCalledWith(edit(2), config, [day, edit(1)])
  })
})

describe("useEntryAutosave beside a morning", () => {
  it("keeps the morning half the day cache already holds", async () => {
    const { result } = loaded()
    // The morning was saved after this evening editor opened.
    const withMorning = { ...day, intention: "stay calm", metrics: { sleep: 4 } }
    queryClient.setQueryData(dayQuery(day.date).queryKey, {
      entry: withMorning,
      synced: [withMorning],
    })
    act(() => result.current.setEntry({ ...edit(1), metrics: { mood: 3 } }))
    expect(cachedDay()?.entry).toMatchObject({
      reflection: "edit 1",
      intention: "stay calm",
      metrics: { mood: 3, sleep: 4 },
    })
    await wait(800)
    expect(cachedDay()).toMatchObject({
      entry: { intention: "stay calm", metrics: { mood: 3, sleep: 4 } },
    })
  })
})

const morning: MorningEntry = {
  date: day.date,
  theme: "recovery",
  intention: "",
  metrics: {},
  updatedAt: "2026-09-12T07:00:00.000Z",
}
// The morning after its nth edit, stamped n minutes later.
const morningEdit = (n: number): MorningEntry => ({
  ...morning,
  intention: `intention ${n}`,
  metrics: { sleep: n },
  updatedAt: `2026-09-12T07:0${n}:00.000Z`,
})
const locked = { message: "morning_locked", code: "MLOCK" }

// As loaded(), for the morning.
function loadedMorning(synced: LoadedMorning["synced"] = [morning]) {
  queryClient = new QueryClient()
  const start = { entry: morning, synced, locked: false }
  queryClient.setQueryData(morningQuery(day.date).queryKey, start)
  return renderHook(() => useMorningAutosave(config, start), { wrapper })
}

const cachedMorning = () => queryClient.getQueryData(morningQuery(day.date).queryKey)

describe("useMorningAutosave", () => {
  it("saves nothing when a morning is loaded", async () => {
    loadedMorning()
    await wait(800)
    expect(loadMorningDraft(day.date)).toBeNull()
    expect(saveMorning).not.toHaveBeenCalled()
  })

  it("drafts a morning edit under its own key and syncs it after the debounce", async () => {
    const { result } = loadedMorning()
    act(() => result.current.setEntry(morningEdit(1)))
    expect(loadMorningDraft(day.date)).toEqual(morningEdit(1))
    expect(loadDraft(day.date)).toBeNull()
    expect(cachedMorning()).toEqual({ entry: morningEdit(1), synced: [morning], locked: false })

    await wait(800)
    expect(saveMorning).toHaveBeenCalledWith(morningEdit(1), config, [morning])
    expect(saveDay).not.toHaveBeenCalled()
    expect(loadMorningDraft(day.date)).toBeNull()
    expect(cachedMorning()).toEqual({
      entry: morningEdit(1),
      synced: [morningEdit(1)],
      locked: false,
    })
  })

  it("syncs a leftover morning draft as soon as it loads", async () => {
    const saved = { ...morning, intention: "saved" }
    loadedMorning([saved])
    await wait(800)
    expect(saveMorning).toHaveBeenCalledWith(morning, config, [saved])
  })

  it("copies a saved morning into the day cache, leaving the evening half alone", async () => {
    const { result } = loadedMorning()
    const evening = { ...edit(1), metrics: { mood: 2, sleep: 1 } }
    queryClient.setQueryData(dayQuery(day.date).queryKey, { entry: evening, synced: [day] })
    act(() => result.current.setEntry(morningEdit(3)))
    await wait(800)
    expect(cachedDay()).toEqual({
      entry: { ...evening, intention: "intention 3", metrics: { mood: 2, sleep: 3 } },
      synced: [day],
    })
  })

  it("leaves an uncached day uncached", async () => {
    const { result } = loadedMorning()
    act(() => result.current.setEntry(morningEdit(1)))
    await wait(800)
    expect(cachedDay()).toBeUndefined()
  })

  it("keeps the morning draft when a sync fails, and tries again on the next edit", async () => {
    vi.mocked(saveMorning).mockRejectedValueOnce(new Error("offline"))
    const { result } = loadedMorning()
    act(() => result.current.setEntry(morningEdit(1)))
    await wait(800)
    expect(toast.error).toHaveBeenCalledWith("Sync failed, kept locally: offline")
    expect(loadMorningDraft(day.date)).toEqual(morningEdit(1))

    act(() => result.current.setEntry(morningEdit(2)))
    await wait(800)
    expect(saveMorning).toHaveBeenCalledTimes(2)
    expect(loadMorningDraft(day.date)).toBeNull()
  })

  it("on a locked morning: one toast, the draft dropped, the morning locked and refetched", async () => {
    vi.mocked(saveMorning).mockRejectedValueOnce(locked)
    const { result } = loadedMorning()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")
    act(() => result.current.setEntry(morningEdit(1)))
    await wait(800)
    expect(getSaveState()).toBe("failed")
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(vi.mocked(toast.error).mock.calls[0]?.[0]).toMatch(/read-only/)
    expect(loadMorningDraft(day.date)).toBeNull()
    expect(cachedMorning()?.locked).toBe(true)
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: morningQuery(day.date).queryKey,
      exact: true,
    })

    // Nothing is drafted or sent again, and a reload can't retry it.
    act(() => result.current.setEntry(morningEdit(2)))
    await wait(800)
    expect(saveMorning).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(loadMorningDraft(day.date)).toBeNull()
  })

  it("drops a save queued behind the one that found the morning locked", async () => {
    let refuse = () => {}
    vi.mocked(saveMorning).mockReturnValueOnce(
      new Promise((_, reject) => {
        refuse = () => reject(locked)
      }),
    )
    const { result } = loadedMorning()
    act(() => result.current.setEntry(morningEdit(1)))
    await wait(800)
    act(() => result.current.setEntry(morningEdit(2)))
    await wait(800)

    refuse()
    await wait(0)
    expect(saveMorning).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledTimes(1)
    // The newer edit's draft goes too: it would only be refused.
    expect(loadMorningDraft(day.date)).toBeNull()
  })
})
