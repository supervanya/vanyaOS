import { describe, expect, it } from "vitest"
import type { Metric } from "@/lib/config"
import { eveningStarted } from "./lock"

const metric = (id: string, timing: Metric["timing"]): Metric => ({
  id,
  label: id,
  group: "Core",
  higherIsBetter: true,
  scale: 5,
  timing,
})
const metrics = [metric("mood", "evening"), metric("sleep", "morning")]
const blank = { reflection: "", intentionLived: null, metrics: {} }

describe("eveningStarted", () => {
  it("is false for a day with only its morning half", () => {
    expect(eveningStarted({ ...blank, metrics: { sleep: 3 } }, metrics)).toBe(false)
  })

  it("is started by a reflection that isn't blank", () => {
    expect(eveningStarted({ ...blank, reflection: "ok" }, metrics)).toBe(true)
    expect(eveningStarted({ ...blank, reflection: "   " }, metrics)).toBe(false)
  })

  it("treats only spaces as blank, as btrim does", () => {
    expect(eveningStarted({ ...blank, reflection: "\n" }, metrics)).toBe(true)
  })

  it("is started by a lived rating", () => {
    expect(eveningStarted({ ...blank, intentionLived: "no" }, metrics)).toBe(true)
  })

  it("is started by any value on an evening metric, even 0", () => {
    expect(eveningStarted({ ...blank, metrics: { mood: 0 } }, metrics)).toBe(true)
  })

  it("ignores a value on a metric it doesn't know", () => {
    expect(eveningStarted({ ...blank, metrics: { gone: 4 } }, metrics)).toBe(false)
  })
})
