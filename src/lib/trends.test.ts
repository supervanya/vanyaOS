import { describe, expect, it } from "vitest"
import type { Metric } from "./config"
import {
  bucketSize,
  bucketize,
  currentStreak,
  habitTrend,
  metricTrend,
  pointsSince,
  sortByStanding,
  standing,
  wellnessSeries,
  wellnessTrend,
  windowStart,
  type Point,
  type SortOrder,
  type Trend,
} from "./trends"

// Day n counted from Sep 1, 2026.
const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n)).toISOString().slice(0, 10)
// One value per consecutive day, starting at day 0.
const series = (values: number[]): Point[] => values.map((value, n) => ({ date: day(n), value }))
const at = (...pairs: [n: number, value: number][]): Point[] =>
  pairs.map(([n, value]) => ({ date: day(n), value }))

const mood: Metric = { id: "mood", label: "Mood", group: "Stimulation", higherIsBetter: true, scale: 5 }
const brainFog: Metric = { id: "brain_fog", label: "Brain fog", group: "Symptoms", higherIsBetter: false, scale: 5 }

describe("metricTrend", () => {
  it("compares the earlier half of the logged days with the later half", () => {
    expect(metricTrend(series([1, 1, 1, 3, 3, 3]), mood)).toEqual({
      early: 1,
      recent: 3,
      verdict: "better",
    })
  })

  it("counts the middle day as recent", () => {
    expect(metricTrend(series([1, 1, 3, 3, 3]), mood)).toMatchObject({ early: 1, recent: 3 })
  })

  it("judges against polarity: a falling symptom is better", () => {
    expect(metricTrend(series([4, 3, 3, 2, 1]), brainFog)?.verdict).toBe("better")
    expect(metricTrend(series([1, 2, 3, 3, 4]), brainFog)?.verdict).toBe("worse")
    expect(metricTrend(series([4, 3, 3, 2, 1]), mood)?.verdict).toBe("worse")
  })

  it("reads a change inside the flat band as flat", () => {
    // 3.05 → 3.1, under the 0.3 band.
    expect(metricTrend(series([3, 3.1, 3, 3.1, 3.2]), mood)?.verdict).toBe("flat")
  })

  it("returns null with fewer than 5 logged days", () => {
    expect(metricTrend(series([1, 2, 3, 4]), mood)).toBeNull()
  })
})

describe("habitTrend", () => {
  it("reports real completion rates, not an extrapolated 0%", () => {
    // Done 4 of the first 6 days, then 1 of the last 6. A fitted line would
    // run below zero here and show 0%; the real recent rate is 1 in 6.
    const trend = habitTrend(series([1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0]))
    expect(trend?.early).toBeCloseTo(4 / 6)
    expect(trend?.recent).toBeCloseTo(1 / 6)
    expect(trend?.verdict).toBe("worse")
  })

  it("reads an evenly spread record as flat", () => {
    expect(habitTrend(series([1, 0, 1, 0, 1, 1, 0, 1, 0, 1]))?.verdict).toBe("flat")
  })
})

describe("wellnessSeries", () => {
  it("averages each day's logged values, with symptoms inverted", () => {
    const byMetric = { mood: at([0, 4], [1, 2]), brain_fog: at([0, 1]) }
    expect(wellnessSeries(byMetric, [mood, brainFog])).toEqual([
      { date: day(0), value: 4 }, // (4 + (5 - 1)) / 2
      { date: day(1), value: 2 }, // only mood was logged
    ])
  })

  it("counts only the metrics it's given, so archived ones drop out", () => {
    const byMetric = { mood: at([0, 3]), archived: at([0, 0]) }
    expect(wellnessSeries(byMetric, [mood])).toEqual([{ date: day(0), value: 3 }])
  })

  it("feeds a higher-is-better trend", () => {
    expect(wellnessTrend(series([2, 2, 2, 4, 4, 4]))?.verdict).toBe("better")
  })
})

describe("currentStreak", () => {
  it("counts done days back from the latest entry", () => {
    expect(currentStreak(at([0, 1], [1, 0], [2, 1], [3, 1]))).toEqual({ days: 2, since: day(2) })
  })

  it("isn't broken by days with no entry", () => {
    expect(currentStreak(at([0, 1], [5, 1]))).toEqual({ days: 2, since: day(0) })
  })

  it("is zero when the latest entry was a miss", () => {
    expect(currentStreak(at([0, 1], [1, 0]))).toEqual({ days: 0, since: null })
  })
})

describe("pointsSince", () => {
  it("keeps points on or after the start", () => {
    expect(pointsSince(at([0, 1], [1, 2], [2, 3]), day(1))).toEqual(at([1, 2], [2, 3]))
  })

  it("keeps everything for all time", () => {
    const all = at([0, 1], [1, 2])
    expect(pointsSince(all, null)).toBe(all)
  })
})

describe("standing", () => {
  const recently = (recent: number): Trend => ({ early: 0, recent, verdict: "better" })

  it("is a habit's recent completion rate", () => {
    expect(standing(recently(0.6), true, 1)).toBeCloseTo(0.6)
  })

  it("puts a slider on a 0-1 scale where 1 is best, flipping symptoms", () => {
    expect(standing(recently(4), true, 5)).toBeCloseTo(0.8)
    expect(standing(recently(1), false, 5)).toBeCloseTo(0.8) // 1/5 brain fog is as good as 4/5 mood
  })

  it("is null without a trend", () => {
    expect(standing(null, true, 5)).toBeNull()
  })
})

describe("sortByStanding", () => {
  const items = [
    { id: "a", standing: 0.2 },
    { id: "b", standing: null },
    { id: "c", standing: 0.9 },
    { id: "d", standing: 0.2 },
  ]
  const ids = (order: SortOrder) =>
    sortByStanding(items, (item) => item.standing, order).map((item) => item.id)

  it("keeps your order", () => {
    expect(ids("yours")).toEqual(["a", "b", "c", "d"])
  })

  it("puts the best first, ties in your order, and unknowns last", () => {
    expect(ids("best")).toEqual(["c", "a", "d", "b"])
  })

  it("puts the worst first, with unknowns still last", () => {
    expect(ids("worst")).toEqual(["a", "d", "c", "b"])
  })
})

describe("windowStart", () => {
  it("covers the window's days, today included", () => {
    expect(windowStart("1M", "2026-09-11")).toBe("2026-08-13")
    expect(windowStart("3M", "2026-09-11")).toBe("2026-06-13")
    expect(windowStart("1Y", "2026-09-11")).toBe("2025-09-12")
  })

  it("is unbounded for all time", () => {
    expect(windowStart("All", "2026-09-11")).toBeNull()
  })
})

describe("bucketSize", () => {
  it("is daily on 1M, weekly after, monthly beyond two years", () => {
    expect(bucketSize("1M", day(0), day(29))).toBe(1)
    expect(bucketSize("3M", day(0), day(90))).toBe(7)
    expect(bucketSize("6M", day(0), day(181))).toBe(7)
    expect(bucketSize("All", day(0), day(400))).toBe(7)
    expect(bucketSize("All", day(0), day(900))).toBe(30)
  })
})

describe("bucketize", () => {
  it("keeps days with no entry as empty buckets, not zeros", () => {
    expect(bucketize(at([0, 1], [2, 0]), day(0), day(2), 1)).toEqual([
      { start: day(0), end: day(0), mean: 1, count: 1 },
      { start: day(1), end: day(1), mean: null, count: 0 },
      { start: day(2), end: day(2), mean: 0, count: 1 },
    ])
  })

  it("aligns buckets to end today, with the oldest taking the remainder", () => {
    expect(bucketize(at([1, 1], [5, 1], [6, 0]), day(0), day(9), 7)).toEqual([
      { start: day(0), end: day(2), mean: 1, count: 1 },
      { start: day(3), end: day(9), mean: 0.5, count: 2 },
    ])
  })

  it("ignores points outside the range", () => {
    const [only] = bucketize(at([-1, 5], [0, 1], [1, 5]), day(0), day(0), 1)
    expect(only).toEqual({ start: day(0), end: day(0), mean: 1, count: 1 })
  })
})
