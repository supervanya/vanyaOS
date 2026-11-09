import { describe, expect, it } from "vitest"
import type { Config } from "@/lib/config"
import type { DayEntry } from "./api"
import { wellness, wellnessByDate, wellnessTone } from "./wellness"

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
    }
    expect(Object.fromEntries(wellnessByDate(series, config))).toEqual({
      "2026-11-01": 4.5,
      "2026-11-02": 2,
      "2026-11-03": null,
    })
  })
})
