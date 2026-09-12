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

/** Composite wellness is on the slider scale, and higher is always better. */
export const wellnessTrend = (points: Point[]) => measureTrend(points, true, METRIC_FLAT_BAND)

/**
 * Daily composite wellness from per-metric series: the mean of each day's
 * logged values with symptoms inverted (scale - value), the same formula as
 * Reflect's live score. Only the metrics passed in count, so archived ones
 * drop out. Sorted by date.
 */
export function wellnessSeries(byMetric: Record<string, Point[]>, metrics: Metric[]): Point[] {
  const scoresByDate = new Map<string, number[]>()
  for (const m of metrics) {
    for (const p of byMetric[m.id] ?? []) {
      const score = m.higherIsBetter ? p.value : m.scale - p.value
      const scores = scoresByDate.get(p.date)
      if (scores) scores.push(score)
      else scoresByDate.set(p.date, [score])
    }
  }
  return [...scoresByDate]
    .map(([date, scores]) => ({ date, value: scores.reduce((a, b) => a + b, 0) / scores.length }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export type Streak = { days: number; since: string | null }

/**
 * Done days in a row up to the latest entry. Points exist only for days with
 * an entry, so a day with no entry never breaks a streak; a missed day does.
 * Pass the full history, not a window, or a long streak gets cut short.
 */
export function currentStreak(points: Point[]): Streak {
  let days = 0
  let since: string | null = null
  for (let i = points.length - 1; i >= 0 && points[i].value === 1; i--) {
    days += 1
    since = points[i].date
  }
  return { days, since }
}

/** Points on or after `from`; all of them when `from` is null (all time). */
export const pointsSince = (points: Point[], from: string | null) =>
  from === null ? points : points.filter((p) => p.date >= from)

/**
 * How good you are at an item lately, from 0 (worst) to 1 (best): its recent
 * average — the right-hand number of its readout — over its scale, flipped when
 * lower is better. For a habit that's the recent completion rate. Null when
 * there's too little data for a trend.
 */
export function standing(trend: Trend | null, higherIsBetter: boolean, scale: number): number | null {
  if (!trend) return null
  const share = trend.recent / scale
  return higherIsBetter ? share : 1 - share
}

export const SORT_ORDERS = ['yours', 'best', 'worst'] as const
export type SortOrder = (typeof SORT_ORDERS)[number]

export const isSortOrder = (value: unknown): value is SortOrder =>
  SORT_ORDERS.includes(value as SortOrder)

/**
 * Items in your order, or by standing with the best or worst first. Items with
 * no standing (too few entries) always go last, and ties keep your order.
 */
export function sortByStanding<T>(
  items: T[],
  standingOf: (item: T) => number | null,
  order: SortOrder,
): T[] {
  if (order === 'yours') return items
  const ranked = items.map((item) => ({ item, standing: standingOf(item) }))
  const known = ranked.filter((r): r is { item: T; standing: number } => r.standing !== null)
  const unknown = ranked.filter((r) => r.standing === null)
  known.sort((a, b) => (order === 'best' ? b.standing - a.standing : a.standing - b.standing))
  return [...known, ...unknown].map((r) => r.item)
}

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
