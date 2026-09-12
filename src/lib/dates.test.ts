import { describe, expect, it } from "vitest"
import { dayOfYear, isoWeek } from "./dates"

// Local dates, the way the app reads "today".
const date = (y: number, m: number, d: number) => new Date(y, m - 1, d)

describe("dayOfYear", () => {
  it("counts from 1 on January 1", () => {
    expect(dayOfYear(date(2026, 1, 1))).toBe(1)
    expect(dayOfYear(date(2026, 9, 12))).toBe(255)
  })

  it("reaches 366 on a leap year's last day", () => {
    expect(dayOfYear(date(2024, 12, 31))).toBe(366)
  })
})

describe("isoWeek", () => {
  it("numbers Monday-to-Sunday weeks", () => {
    expect(isoWeek(date(2026, 9, 7))).toBe(37) // Monday
    expect(isoWeek(date(2026, 9, 13))).toBe(37) // Sunday
    expect(isoWeek(date(2026, 9, 14))).toBe(38) // next Monday
  })

  it("puts late-December days in the new year's week 1 when its Thursday is in January", () => {
    expect(isoWeek(date(2025, 12, 29))).toBe(1)
  })

  it("puts early-January days in the old year's last week when its Thursday is in December", () => {
    expect(isoWeek(date(2027, 1, 1))).toBe(53)
  })
})
