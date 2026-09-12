import { describe, expect, it } from "vitest"
import type { Config } from "./config"
import type { DayEntry } from "./storage"
import { wellness } from "./wellness"

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
