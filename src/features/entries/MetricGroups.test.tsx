// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Metric } from "@/lib/config"
import { MetricGroups } from "./MetricGroups"

// Radix measures the thumb with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

afterEach(cleanup)

const metric = (id: string, group: string, higherIsBetter: boolean): Metric => ({
  id,
  label: id,
  group,
  higherIsBetter,
  scale: 5,
  timing: "morning",
})

const metrics = [
  metric("Energy", "Core", true),
  metric("Headache", "Symptoms", false),
  metric("Focus", "Core", true),
]

function renderGroups(values: Record<string, number> = {}) {
  const onChange = vi.fn<(id: string, value: number | undefined) => void>()
  render(<MetricGroups metrics={metrics} values={values} onChange={onChange} />)
  return onChange
}

describe("MetricGroups", () => {
  it("groups the sliders in config order", () => {
    renderGroups()
    expect(screen.getAllByText(/^(Core|Symptoms)/).map((el) => el.textContent)).toEqual([
      "Core",
      "Symptoms · 0 is best",
    ])
    expect(screen.getAllByRole("slider")).toHaveLength(3)
  })

  it("shows set values and a dash for unset ones", () => {
    renderGroups({ Energy: 4 })
    expect(screen.getByText("4", { selector: "span.w-6" })).toBeDefined()
    expect(screen.getAllByText("–")).toHaveLength(2)
  })

  it("reports a change with the metric's id", () => {
    const onChange = renderGroups()
    const [, , headache] = screen.getAllByRole("slider")
    if (!headache) throw new Error("no slider")
    fireEvent.keyDown(headache, { key: "ArrowRight" })
    expect(onChange).toHaveBeenCalledWith("Headache", 1)
  })
})
