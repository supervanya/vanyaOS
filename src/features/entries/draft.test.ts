// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { clearDraft, loadDraft, saveDraft, type DayEntry } from "./api"

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }))

const entry: DayEntry = {
  date: "2026-09-19",
  theme: "recovery",
  metrics: { mood: 4 },
  habits: { steps: true },
  reflection: "ok day",
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
