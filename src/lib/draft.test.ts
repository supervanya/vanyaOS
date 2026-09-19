// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { loadDraft, saveDraft, type DayEntry } from "./storage"

vi.mock("./supabaseClient", () => ({ supabase: {} }))

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
})
