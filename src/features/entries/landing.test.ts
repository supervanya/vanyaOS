// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { LoadedConfig } from "@/features/config/api"
import { configQuery } from "@/features/config/queries"
import { DEFAULT_MORNING_PREFS, type MorningPrefs } from "@/features/settings/api"
import { morningPrefsQuery } from "@/features/settings/queries"
import type { Metric } from "@/lib/config"
import type { DayEntry, LoadedMorning, loadOrInitMorning, MorningEntry } from "./api"
import { morningSkipped, opensOnMorning, shouldOpenMorning, skipMorning } from "./landing"
import { dayQuery, morningQuery } from "./queries"

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }))
// Only reached when a test leaves today's morning out of the cache.
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  loadOrInitMorning: vi.fn<typeof loadOrInitMorning>(() => Promise.reject(new Error("offline"))),
}))

const metric = (id: string, timing: Metric["timing"]): Metric => ({
  id,
  label: id,
  group: "Core",
  higherIsBetter: true,
  scale: 5,
  timing,
})
const metrics = [metric("mood", "evening"), metric("sleep", "morning")]
const blank: Pick<MorningEntry, "intention" | "metrics"> = { intention: "", metrics: {} }
const at = (hours: number, minutes = 0) => new Date(2026, 10, 12, hours, minutes)
const prefs = DEFAULT_MORNING_PREFS
const base = { now: at(9), prefs, morning: blank, locked: false, skipped: false, metrics }

describe("shouldOpenMorning", () => {
  it("opens on a blank morning before noon", () => {
    expect(shouldOpenMorning(base)).toBe(true)
    expect(shouldOpenMorning({ ...base, now: at(11, 59) })).toBe(true)
  })

  it("stops at exactly 12:00", () => {
    expect(shouldOpenMorning({ ...base, now: at(12, 0) })).toBe(false)
    expect(shouldOpenMorning({ ...base, now: at(18) })).toBe(false)
  })

  it("stops at the time the morning closes, when Settings moves it", () => {
    const early = { ...prefs, closesAt: 9 * 60 + 30 }
    expect(shouldOpenMorning({ ...base, prefs: early, now: at(9, 29) })).toBe(true)
    expect(shouldOpenMorning({ ...base, prefs: early, now: at(9, 30) })).toBe(false)
    const late = { ...prefs, closesAt: 15 * 60 }
    expect(shouldOpenMorning({ ...base, prefs: late, now: at(14, 59) })).toBe(true)
    expect(shouldOpenMorning({ ...base, prefs: late, now: at(15) })).toBe(false)
  })

  it("never opens when the redirect is turned off", () => {
    expect(shouldOpenMorning({ ...base, prefs: { ...prefs, redirect: false } })).toBe(false)
  })

  it("waits until the app's day starts, in the small hours", () => {
    expect(shouldOpenMorning({ ...base, now: at(2) })).toBe(false)
    expect(shouldOpenMorning({ ...base, now: at(4) })).toBe(true)
  })

  it("is set by intention text, but not by whitespace", () => {
    expect(shouldOpenMorning({ ...base, morning: { ...blank, intention: "focus" } })).toBe(false)
    expect(shouldOpenMorning({ ...base, morning: { ...blank, intention: " \n\t" } })).toBe(true)
  })

  it("is set by a morning slider alone, even at 0", () => {
    expect(shouldOpenMorning({ ...base, morning: { ...blank, metrics: { sleep: 0 } } })).toBe(false)
  })

  it("ignores a value on a metric that isn't a morning one", () => {
    expect(shouldOpenMorning({ ...base, morning: { ...blank, metrics: { mood: 3 } } })).toBe(true)
  })

  it("doesn't open on a skipped day", () => {
    expect(shouldOpenMorning({ ...base, skipped: true })).toBe(false)
  })

  it("doesn't open on a locked day: the evening is started", () => {
    expect(shouldOpenMorning({ ...base, locked: true })).toBe(false)
  })
})

describe("Skip today", () => {
  afterEach(() => localStorage.clear())

  it("is remembered per date, and drops other days' flags", () => {
    localStorage.setItem("vanyaos:morning-skip:2026-11-10", "1")
    localStorage.setItem("vanyaos:draft:2026-11-10", "{}")
    expect(morningSkipped("2026-11-11")).toBe(false)
    skipMorning("2026-11-11")
    expect(morningSkipped("2026-11-11")).toBe(true)
    expect(localStorage.getItem("vanyaos:morning-skip:2026-11-11")).toBe("1")
    expect(localStorage.getItem("vanyaos:morning-skip:2026-11-10")).toBeNull()
    expect(localStorage.getItem("vanyaos:draft:2026-11-10")).toBe("{}")
  })

  it("only takes the flag it wrote", () => {
    localStorage.setItem("vanyaos:morning-skip:2026-11-01", "yes")
    expect(morningSkipped("2026-11-01")).toBe(false)
  })

  it("treats storage that throws as not skipped, and still skips for the session", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied")
    })
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied")
    })
    expect(morningSkipped("2026-11-02")).toBe(false)
    skipMorning("2026-11-02")
    expect(morningSkipped("2026-11-02")).toBe(true)
    get.mockRestore()
    set.mockRestore()
  })
})

describe("opensOnMorning", () => {
  const config: LoadedConfig = {
    activeTheme: "recovery",
    themes: ["recovery"],
    metrics,
    habits: [],
    goals: [],
    metricRowId: {},
    habitRowId: {},
  }
  const today = "2026-11-12"
  const morning = (patch: Partial<MorningEntry> = {}): LoadedMorning => ({
    entry: {
      date: today,
      theme: "recovery",
      intention: "",
      metrics: {},
      updatedAt: "2026-11-12T06:00:00.000Z",
      ...patch,
    },
    unsynced: false,
    locked: false,
  })
  const client = (loaded?: LoadedMorning, saved: MorningPrefs | null = prefs) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(configQuery.queryKey, config)
    if (saved) qc.setQueryData(morningPrefsQuery.queryKey, saved)
    if (loaded) qc.setQueryData(morningQuery(today).queryKey, loaded)
    return qc
  }

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  // todayISO() reads the clock, so pin it to the same morning.
  const morningOf = (hours: number) => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(at(hours))
    return at(hours)
  }

  it("opens on a blank morning, and not on one with an unsynced draft", async () => {
    const now = morningOf(8)
    expect(await opensOnMorning(client(morning()), now)).toBe(true)
    const draft = { ...morning({ intention: "write" }), unsynced: true }
    expect(await opensOnMorning(client(draft), now)).toBe(false)
  })

  it("doesn't open once this session has started the day's evening", async () => {
    const now = morningOf(8)
    const qc = client(morning())
    const day: DayEntry = {
      date: today,
      theme: "recovery",
      metrics: { mood: 2 },
      habits: {},
      reflection: "",
      intention: "",
      intentionLived: null,
      updatedAt: "2026-11-12T07:00:00.000Z",
    }
    qc.setQueryData(dayQuery(today).queryKey, { entry: day, unsynced: true })
    expect(await opensOnMorning(qc, now)).toBe(false)
  })

  it("falls through to the dashboard when the morning can't be loaded", async () => {
    const now = morningOf(8)
    expect(await opensOnMorning(client(), now)).toBe(false)
  })

  it("follows the saved preferences", async () => {
    const off = client(morning(), { ...prefs, redirect: false })
    expect(await opensOnMorning(off, morningOf(8))).toBe(false)
    const late = client(morning(), { ...prefs, closesAt: 15 * 60 })
    expect(await opensOnMorning(late, morningOf(14))).toBe(true)
  })

  it("falls through to the dashboard when the preferences can't be loaded", async () => {
    // Nothing cached, and the mocked Supabase client can't answer.
    expect(await opensOnMorning(client(morning(), null), morningOf(8))).toBe(false)
  })

  it("loads only the preferences once the morning has closed", async () => {
    const qc = client()
    const ensure = vi.spyOn(qc, "ensureQueryData")
    expect(await opensOnMorning(qc, morningOf(13))).toBe(false)
    expect(ensure).toHaveBeenCalledTimes(1)
    expect(ensure).toHaveBeenCalledWith(morningPrefsQuery)
  })

  it("loads nothing before the day starts or on a skipped day", async () => {
    const qc = client()
    const ensure = vi.spyOn(qc, "ensureQueryData")
    expect(await opensOnMorning(qc, morningOf(2))).toBe(false)
    skipMorning(today)
    expect(await opensOnMorning(qc, morningOf(8))).toBe(false)
    expect(ensure).not.toHaveBeenCalled()
  })
})
