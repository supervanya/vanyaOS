// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { Bucket } from "./math"
import { Sparkline, describeBucket } from "./Sparkline"

afterEach(cleanup)

const day = (date: string, mean: number | null): Bucket => ({
  start: date,
  end: date,
  mean,
  count: mean === null ? 0 : 1,
})
const format = (v: number) => v.toFixed(1)

describe("describeBucket", () => {
  it("names a morning-only day", () => {
    expect(describeBucket(day("2026-11-10", 4), format, 1)).toMatch(/· 4\.0 · morning only$/)
    expect(describeBucket(day("2026-11-10", 4), format)).toMatch(/· 4\.0$/)
  })

  it("counts morning-only days in a longer bucket", () => {
    const week = { start: "2026-11-04", end: "2026-11-10", mean: 3, count: 5 }
    expect(describeBucket(week, format, 2)).toMatch(/avg 3\.0 over 5 days \(2 morning only\)$/)
  })
})

describe("Sparkline", () => {
  it("rings the partial days it's given, and only those with a value", () => {
    const { container } = render(
      <Sparkline
        buckets={[day("2026-11-08", 3), day("2026-11-09", 4), day("2026-11-10", null)]}
        max={5}
        format={format}
        partialDates={new Set(["2026-11-09", "2026-11-10"])}
      />,
    )
    const rings = [...container.querySelectorAll<HTMLElement>("[data-partial]")]
    expect(rings.map((r) => r.dataset.partial)).toEqual(["2026-11-09"])
  })
})
