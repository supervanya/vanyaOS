import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG, groupMetrics, metricsAt, type Metric, type MetricTiming } from "./config"

const metric = (id: string, group: string, timing: MetricTiming = "evening"): Metric => ({
  id,
  label: id,
  group,
  higherIsBetter: true,
  scale: 5,
  timing,
})

describe("groupMetrics", () => {
  it("groups metrics in order of first appearance, keeping their order", () => {
    const [eating, reading, movement] = [
      metric("eating", "Discipline"),
      metric("reading", "Growth"),
      metric("movement", "Discipline"),
    ]
    expect(groupMetrics([eating, reading, movement])).toEqual([
      { group: "Discipline", metrics: [eating, movement] },
      { group: "Growth", metrics: [reading] },
    ])
  })
})

describe("metricsAt", () => {
  it("keeps one half's metrics, in order", () => {
    const [sleep, eating, energy] = [
      metric("sleep", "Recovery", "morning"),
      metric("eating", "Discipline"),
      metric("energy", "Recovery", "morning"),
    ]
    expect(metricsAt([sleep, eating, energy], "morning")).toEqual([sleep, energy])
    expect(metricsAt([sleep, eating, energy], "evening")).toEqual([eating])
  })

  it("asks every default metric in the evening", () => {
    expect(metricsAt(DEFAULT_CONFIG.metrics, "evening")).toEqual(DEFAULT_CONFIG.metrics)
  })
})
