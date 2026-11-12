import type { Metric } from "@/lib/config"
import { describe, expect, it, vi } from "vitest"
import { formatIntakeSignal, intakeWindow, type IntakeData, type IntakeDay } from "./intake"

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }))

const metric = (id: string, overrides: Partial<Metric> = {}): Metric => ({
  id,
  label: id,
  group: "G",
  higherIsBetter: true,
  scale: 5,
  timing: "evening",
  ...overrides,
})

const config = {
  metrics: [
    metric("mood", { label: "Mood" }),
    metric("fog", { label: "Brain fog", higherIsBetter: false }),
    metric("sleep", { label: "Sleep quality", timing: "morning" }),
  ],
  habits: [
    { id: "walk", label: "Walk" },
    { id: "read", label: "Read" },
  ],
  metricRowId: { mood: "m-mood", fog: "m-fog", sleep: "m-sleep" },
  habitRowId: { walk: "h-walk", read: "h-read" },
}

const day = (n: number, overrides: Partial<IntakeDay> = {}): IntakeDay => ({
  id: `e${n}`,
  date: `2026-11-${String(n).padStart(2, "0")}`,
  reflection: "",
  intention: "",
  lived: null,
  ...overrides,
})

const data = (overrides: Partial<IntakeData>): IntakeData => ({
  days: [],
  values: [],
  habits: [],
  wellness: [],
  ...overrides,
})

const section = (text: string, heading: string) => {
  const start = text.indexOf(`### ${heading}`)
  if (start < 0) throw new Error(`no section ${heading}`)
  const end = text.indexOf("\n### ", start + 1)
  return text.slice(start, end < 0 ? undefined : end)
}

describe("intakeWindow", () => {
  it("starts at the last coach run", () => {
    expect(intakeWindow("2026-11-01T18:30:00Z", "2026-11-12")).toEqual({
      since: "2026-11-01",
      label: "since the last retro (2026-11-01)",
    })
  })

  it("looks back 60 days on an area's first retro", () => {
    expect(intakeWindow(null, "2026-11-12")).toEqual({
      since: "2026-09-13",
      label: "last 60 days (first retro for this area)",
    })
  })
})

describe("formatIntakeSignal", () => {
  it("says so when the window has no days", () => {
    expect(formatIntakeSignal("last 60 days", data({}), config)).toBe(
      "(no journal data in the window: last 60 days)",
    )
  })

  it("averages each metric and names a trend between the window's halves", () => {
    const days = [day(1), day(2), day(3), day(4)]
    const text = formatIntakeSignal(
      "w",
      data({
        days,
        values: [
          { entryId: "e1", metricId: "m-mood", value: 1 },
          { entryId: "e2", metricId: "m-mood", value: 2 },
          { entryId: "e3", metricId: "m-mood", value: 4 },
          { entryId: "e4", metricId: "m-mood", value: 5 },
          { entryId: "e1", metricId: "m-fog", value: 3 },
          { entryId: "e4", metricId: "m-fog", value: 3 },
        ],
      }),
      config,
    )
    expect(text).toContain("- Mood: avg 3.0/5 (trending up: 1.5 -> 4.5)")
    expect(text).toContain("- Brain fog [0 is best]: avg 3.0/5\n")
  })

  it("marks morning-timed metrics", () => {
    const text = formatIntakeSignal(
      "w",
      data({ days: [day(1)], values: [{ entryId: "e1", metricId: "m-sleep", value: 4 }] }),
      config,
    )
    expect(text).toContain("- Sleep quality [morning]: avg 4.0/5")
    expect(text).not.toContain("Mood:")
  })

  it("averages wellness over scored days only", () => {
    const text = formatIntakeSignal(
      "w",
      data({
        days: [day(1), day(2), day(3)],
        wellness: [
          { entryId: "e1", wellness: 4 },
          { entryId: "e3", wellness: 2 },
        ],
      }),
      config,
    )
    // e2 has no score: averaged in as 0 it would read 2.0.
    expect(text).toContain("- Composite wellness: avg 3.0/5")
  })

  it("counts habit completions over the days the habit was saved", () => {
    const text = formatIntakeSignal(
      "w",
      data({
        days: [day(1), day(2), day(3)],
        habits: [
          { entryId: "e1", habitId: "h-walk", done: true },
          { entryId: "e2", habitId: "h-walk", done: false },
          { entryId: "e3", habitId: "h-walk", done: true },
        ],
      }),
      config,
    )
    expect(section(text, "Habits")).toContain("- Walk: 2/3")
    expect(text).not.toContain("- Read:")
  })

  it("counts a morning-only day as tracked", () => {
    const text = formatIntakeSignal(
      "since the last retro (2026-11-01)",
      data({
        days: [day(1, { reflection: "Long day." }), day(2, { intention: "Ship the retro intake" })],
      }),
      config,
    )
    expect(text.split("\n")[0]).toBe(
      "Journal signal, since the last retro (2026-11-01) — 2 day(s) tracked.",
    )
  })

  it("lists each morning's intention with its lived rating, and tallies follow-through", () => {
    const text = formatIntakeSignal(
      "w",
      data({
        days: [
          day(1, { intention: "Deep work before lunch", lived: "yes" }),
          day(2, { intention: "  Call mum\nand walk  ", lived: "partly" }),
          day(3, { intention: "No phone in bed", lived: "no" }),
          day(4, { intention: "Finish the tax form" }),
          day(5, { intention: "Walk at noon", lived: "yes" }),
          day(6, { intention: "   ", lived: null }),
          day(7),
        ],
      }),
      config,
    )
    const intentions = section(text, "Morning intentions")
    expect(intentions).toContain("- 2026-11-01 [lived: yes]: Deep work before lunch")
    expect(intentions).toContain("- 2026-11-02 [lived: partly]: Call mum and walk")
    expect(intentions).toContain("- 2026-11-03 [lived: no]: No phone in bed")
    expect(intentions).toContain("- 2026-11-04: Finish the tax form")
    expect(intentions).not.toContain("2026-11-06")
    expect(intentions).toContain(
      "Lived: 2 yes / 1 partly / 1 no / 1 unrated (5 day(s) with an intention)",
    )
  })

  it("says when no intention was written", () => {
    const text = formatIntakeSignal("w", data({ days: [day(1)] }), config)
    expect(section(text, "Morning intentions")).toContain(
      "(none in this window - no morning intention was written)",
    )
    expect(text).not.toContain("Lived:")
  })

  it("puts intentions after the numbers and before the reflections", () => {
    const text = formatIntakeSignal(
      "w",
      data({ days: [day(1, { intention: "Rest", reflection: "Rested." })] }),
      config,
    )
    const order = ["### Metrics", "### Habits", "### Morning intentions", "### Written reflections"]
    const positions = order.map((h) => text.indexOf(h))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect(positions).toEqual(positions.toSorted((a, b) => a - b))
  })

  it("lists written reflections with their wellness, and counts the days without one", () => {
    const text = formatIntakeSignal(
      "w",
      data({
        days: [day(1, { reflection: "Good run." }), day(2), day(3, { reflection: "Tired." })],
        wellness: [{ entryId: "e1", wellness: 4.25 }],
      }),
      config,
    )
    const reflections = section(text, "Written reflections")
    expect(reflections).toContain("- 2026-11-01 (wellness 4.3/5): Good run.")
    expect(reflections).toContain("- 2026-11-03: Tired.")
    expect(reflections).toContain("(1 more day(s) had no written reflection;")
  })

  it("says when nothing was written", () => {
    const text = formatIntakeSignal("w", data({ days: [day(1)] }), config)
    expect(section(text, "Written reflections")).toContain("(none in this window")
  })
})
