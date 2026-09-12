import { describe, expect, it } from "vitest"
import { groupMetrics, type Metric } from "./config"

const metric = (id: string, group: string): Metric => ({
  id,
  label: id,
  group,
  higherIsBetter: true,
  scale: 5,
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
