// Trend maths for the Trends screen: which way a daily series is moving over a
// window, and how to bucket it for display. Pure functions — no Supabase, no
// React — so metric sparklines, habit cells and the slider context in Reflect
// all share one tested implementation.

import type { Metric } from './config'

/** One logged day. Days without an entry are absent, never zero. */
export type Point = { date: string; value: number } // date is YYYY-MM-DD

export const TREND_WINDOWS = {
  '1M': { days: 30 },
  '3M': { days: 91 },
  '6M': { days: 182 },
  '1Y': { days: 365 },
  All: { days: null },
} as const satisfies Record<string, { days: number | null }>

export type TrendWindow = keyof typeof TREND_WINDOWS

export const isTrendWindow = (value: unknown): value is TrendWindow =>
  typeof value === 'string' && Object.hasOwn(TREND_WINDOWS, value)

/** Judged against the item's polarity: a falling symptom is "better". */
export type Verdict = 'better' | 'worse' | 'flat'

export type Trend = {
  early: number // average of the earlier half of the logged days
  recent: number // average of the later half
  verdict: Verdict
}

/** Below this many logged days, a comparison is noise. */
export const MIN_POINTS = 5
/** A change smaller than this across the window reads as flat. */
export const METRIC_FLAT_BAND = 0.3 // points on the 0-5 slider
export const HABIT_FLAT_BAND = 0.1 // share of days done: 10 percentage points

/**
 * Compares the average of the earlier half of the logged days with the later
 * half (the middle day, if any, counts as recent). Both numbers are real
 * averages of what was logged — a fitted line would overshoot on done/missed
 * data and report a misleading 0% or 100%. Points must be sorted by date.
 * Null when there's too little data to judge.
 */
function measureTrend(points: Point[], higherIsBetter: boolean, flatBand: number): Trend | null {
  if (points.length < MIN_POINTS) return null
  const half = Math.floor(points.length / 2)
  const early = mean(points.slice(0, half))
  const recent = mean(points.slice(half))
  return { early, recent, verdict: judge(recent - early, higherIsBetter, flatBand) }
}

export const metricTrend = (points: Point[], metric: Metric) =>
  measureTrend(points, metric.higherIsBetter, METRIC_FLAT_BAND)

/** Habit points are 1 (done) or 0 (missed), so the averages are completion rates. */
export const habitTrend = (points: Point[]) => measureTrend(points, true, HABIT_FLAT_BAND)

/** First day a window covers (today inclusive), or null for all time. */
export function windowStart(window: TrendWindow, today: string): string | null {
  const { days } = TREND_WINDOWS[window]
  return days === null ? null : fromDay(toDay(today) - (days - 1))
}

const TWO_YEARS = 730
const WEEK = 7
const MONTH = 30

/** Daily on 1M; weekly otherwise, until two years of data make weeks too thin to see. */
export function bucketSize(window: TrendWindow, from: string, to: string): number {
  if (window === '1M') return 1
  return toDay(to) - toDay(from) + 1 > TWO_YEARS ? MONTH : WEEK
}

export type Bucket = {
  start: string
  end: string
  mean: number | null // null when nothing was logged in the bucket
  count: number // logged days
}

/**
 * Splits [from, to] into `size`-day buckets aligned to end on `to`, so the most
 * recent bucket is always whole and the oldest one takes the remainder.
 */
export function bucketize(points: Point[], from: string, to: string, size: number): Bucket[] {
  const first = toDay(from)
  const last = toDay(to)
  const n = Math.ceil((last - first + 1) / size)
  const sums = new Array<number>(n).fill(0)
  const counts = new Array<number>(n).fill(0)

  for (const p of points) {
    const day = toDay(p.date)
    if (day < first || day > last) continue
    const i = n - 1 - Math.floor((last - day) / size)
    sums[i] += p.value
    counts[i] += 1
  }

  return sums.map((sum, i) => {
    const end = last - (n - 1 - i) * size
    return {
      start: fromDay(Math.max(first, end - size + 1)),
      end: fromDay(end),
      mean: counts[i] ? sum / counts[i] : null,
      count: counts[i],
    }
  })
}

function judge(change: number, higherIsBetter: boolean, flatBand: number): Verdict {
  if (Math.abs(change) < flatBand) return 'flat'
  return (change > 0) === higherIsBetter ? 'better' : 'worse'
}

const mean = (points: Point[]) => points.reduce((sum, p) => sum + p.value, 0) / points.length

// Calendar days as integers. UTC, so a DST change never shifts a date.
const MS_PER_DAY = 86_400_000
const toDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY)
const fromDay = (day: number) => new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
