import { describe, expect, it } from "vitest"
import type { Config, Metric } from "@/lib/config"
import type { DayEntry } from "./api"
import { morningOnlyDates, wellness, wellnessByDate, wellnessTone } from "./wellness"

const config = {
  metrics: [
    { id: "mood", label: "Mood", group: "Stimulation", higherIsBetter: true, scale: 5 },
    { id: "brain_fog", label: "Brain fog", group: "Symptoms", higherIsBetter: false, scale: 5 },
  ],
} as Config

const entry = (metrics: Record<string, number>) => ({ metrics }) as DayEntry

describe("wellness", () => {
  it("averages only the sliders that were set", () => {
    expect(wellness(entry({ mood: 4 }), config)).toBe(4)
  })

  it("inverts symptoms, so 0 brain fog counts as 5", () => {
    expect(wellness(entry({ mood: 3, brain_fog: 0 }), config)).toBe(4)
  })

  it("is null when no slider was set", () => {
    expect(wellness(entry({}), config)).toBeNull()
  })
})

describe("wellnessTone", () => {
  it("bands scores at 3.75 and 2.5", () => {
    expect([5, 3.75, 3.7, 2.5, 2.4, 0].map(wellnessTone)).toEqual([
      "good",
      "good",
      "ok",
      "ok",
      "bad",
      "bad",
    ])
  })
})

describe("wellnessByDate", () => {
  it("scores each logged day from its metrics, null when only habits were logged", () => {
    const series = {
      firstDate: "2026-11-01",
      metrics: {
        mood: [
          { date: "2026-11-01", value: 4 },
          { date: "2026-11-02", value: 2 },
        ],
        brain_fog: [{ date: "2026-11-01", value: 0 }],
      },
      habits: { walk: [{ date: "2026-11-03", value: 1 }] },
      intentionDates: ["2026-11-04"],
      writtenEveningDates: [],
    }
    expect([...wellnessByDate(series, config)]).toEqual([
      ["2026-11-01", 4.5],
      ["2026-11-02", 2],
      ["2026-11-03", null],
      ["2026-11-04", null], // an intention and nothing else
    ])
  })
})

describe("morningOnlyDates", () => {
  const metrics = [
    { id: "mood", label: "Mood", group: "G", higherIsBetter: true, scale: 5, timing: "evening" },
    { id: "sleep", label: "Sleep", group: "G", higherIsBetter: true, scale: 5, timing: "morning" },
  ] satisfies Metric[]
  const point = (date: string) => ({ date, value: 3 })

  it("picks days with a morning and nothing of the evening", () => {
    const series = {
      firstDate: "2026-11-01",
      metrics: {
        sleep: ["01", "02", "03", "04", "06"].map((d) => point(`2026-11-${d}`)),
        mood: [point("2026-11-01"), point("2026-11-05")],
      },
      // Habit ticks don't start the evening: the dashboard takes them all day.
      habits: { walk: [point("2026-11-02"), point("2026-11-08")] },
      intentionDates: ["2026-11-03", "2026-11-07"],
      writtenEveningDates: ["2026-11-04"],
    }
    expect([...morningOnlyDates(series, metrics)].toSorted()).toEqual([
      "2026-11-02", // a morning slider and a habit
      "2026-11-03", // a morning slider and an intention
      "2026-11-06", // a morning slider
      "2026-11-07", // an intention
    ])
  })

  it("leaves days from before any metric was asked in the morning alone", () => {
    const series = {
      firstDate: "2026-11-01",
      metrics: { mood: [point("2026-11-01")] },
      habits: { walk: [point("2026-11-02")] },
      intentionDates: [],
      writtenEveningDates: [],
    }
    expect(morningOnlyDates(series, metrics).size).toBe(0)
  })
})
