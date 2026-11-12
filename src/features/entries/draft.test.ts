// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearDraft,
  clearMorningDraft,
  loadDraft,
  loadMorningDraft,
  saveDraft,
  saveMorningDraft,
  type DayEntry,
  type MorningEntry,
} from "./api"

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }))

const entry: DayEntry = {
  date: "2026-09-19",
  theme: "recovery",
  metrics: { mood: 4 },
  habits: { steps: true },
  reflection: "ok day",
  intention: "be patient",
  intentionLived: "partly",
  updatedAt: "2026-09-19T21:00:00.000Z",
}
const key = `vanyaos:draft:${entry.date}`

afterEach(() => localStorage.clear())

describe("local drafts", () => {
  it("round-trips a saved entry", () => {
    saveDraft(entry)
    expect(loadDraft(entry.date)).toEqual(entry)
  })

  it("returns null when there is no draft", () => {
    expect(loadDraft(entry.date)).toBeNull()
  })

  it("ignores a draft that isn't valid JSON", () => {
    localStorage.setItem(key, "{not json")
    expect(loadDraft(entry.date)).toBeNull()
  })

  it("ignores a draft with the wrong shape instead of trusting it", () => {
    localStorage.setItem(key, JSON.stringify({ ...entry, metrics: { mood: "4" } }))
    expect(loadDraft(entry.date)).toBeNull()
    localStorage.setItem(key, JSON.stringify({ date: entry.date }))
    expect(loadDraft(entry.date)).toBeNull()
  })

  it("reads a draft saved before intentions existed as not rated", () => {
    const { intention: _, intentionLived: __, ...older } = entry
    localStorage.setItem(key, JSON.stringify(older))
    expect(loadDraft(entry.date)).toEqual({ ...entry, intention: "", intentionLived: null })
  })

  it("ignores a draft whose intention isn't text", () => {
    localStorage.setItem(key, JSON.stringify({ ...entry, intention: 3 }))
    expect(loadDraft(entry.date)).toBeNull()
  })

  it("never reads the morning draft of the same day", () => {
    saveMorningDraft(morning)
    expect(loadDraft(entry.date)).toBeNull()
  })

  it("ignores a draft with an unknown lived rating", () => {
    localStorage.setItem(key, JSON.stringify({ ...entry, intentionLived: "mostly" }))
    expect(loadDraft(entry.date)).toBeNull()
  })

  it("clears the draft once the entry it holds is saved", () => {
    saveDraft(entry)
    clearDraft(entry)
    expect(loadDraft(entry.date)).toBeNull()
  })

  it("keeps a draft that has moved on to a newer edit", () => {
    const newer = { ...entry, reflection: "better day", updatedAt: "2026-09-19T21:05:00.000Z" }
    saveDraft(newer)
    clearDraft(entry)
    expect(loadDraft(entry.date)).toEqual(newer)
  })
})

const morning: MorningEntry = {
  date: entry.date,
  theme: "recovery",
  intention: "be patient",
  metrics: { sleep: 3 },
  updatedAt: "2026-09-19T07:00:00.000Z",
}
const morningKey = `vanyaos:draft:morning:${morning.date}`

describe("local morning drafts", () => {
  it("round-trips a morning under its own key", () => {
    saveMorningDraft(morning)
    expect(localStorage.getItem(morningKey)).not.toBeNull()
    expect(loadMorningDraft(morning.date)).toEqual(morning)
  })

  it("keeps the morning and evening drafts of one day apart", () => {
    saveDraft(entry)
    saveMorningDraft(morning)
    expect(loadDraft(entry.date)).toEqual(entry)
    expect(loadMorningDraft(morning.date)).toEqual(morning)
    clearDraft(entry)
    expect(loadMorningDraft(morning.date)).toEqual(morning)
  })

  it("returns null when there is no morning draft", () => {
    saveDraft(entry)
    expect(loadMorningDraft(morning.date)).toBeNull()
  })

  it("ignores a morning draft that isn't valid JSON", () => {
    localStorage.setItem(morningKey, "{not json")
    expect(loadMorningDraft(morning.date)).toBeNull()
  })

  it("rejects an evening-shaped record under the morning key", () => {
    localStorage.setItem(morningKey, JSON.stringify(entry))
    expect(loadMorningDraft(morning.date)).toBeNull()
  })

  it("rejects an untagged morning (an older shape)", () => {
    localStorage.setItem(morningKey, JSON.stringify(morning))
    expect(loadMorningDraft(morning.date)).toBeNull()
  })

  it("rejects a morning draft with the wrong shape", () => {
    const tagged = { half: "morning", ...morning }
    localStorage.setItem(morningKey, JSON.stringify({ ...tagged, metrics: { sleep: "3" } }))
    expect(loadMorningDraft(morning.date)).toBeNull()
    localStorage.setItem(morningKey, JSON.stringify({ ...tagged, intention: null }))
    expect(loadMorningDraft(morning.date)).toBeNull()
  })

  it("rejects a morning draft filed under another date", () => {
    localStorage.setItem(
      morningKey,
      JSON.stringify({ half: "morning", ...morning, date: "2026-09-18" }),
    )
    expect(loadMorningDraft(morning.date)).toBeNull()
  })

  it("keeps only the morning's own fields", () => {
    localStorage.setItem(
      morningKey,
      JSON.stringify({ half: "morning", ...morning, reflection: "stray" }),
    )
    expect(loadMorningDraft(morning.date)).toEqual(morning)
  })

  it("clears the morning draft once it is saved, but not a newer edit", () => {
    saveMorningDraft(morning)
    clearMorningDraft(morning)
    expect(loadMorningDraft(morning.date)).toBeNull()

    const newer = { ...morning, intention: "be kind", updatedAt: "2026-09-19T07:05:00.000Z" }
    saveMorningDraft(newer)
    clearMorningDraft(morning)
    expect(loadMorningDraft(morning.date)).toEqual(newer)
  })
})
