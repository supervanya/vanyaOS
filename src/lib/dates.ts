// Calendar numbers for a local date: the day of the year (Jan 1 = 1) and the
// ISO 8601 week (weeks start on Monday; week 1 holds the year's first Thursday).

const MS_PER_DAY = 86_400_000

// The local calendar date as a UTC timestamp, so a DST change never skews a
// count of days.
const utcDate = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())

export function dayOfYear(d: Date): number {
  return (utcDate(d) - Date.UTC(d.getFullYear(), 0, 1)) / MS_PER_DAY + 1
}

/**
 * The ISO week. Its Thursday decides which year a week belongs to, so the
 * first days of January can still be week 52 or 53 of the year before.
 */
export function isoWeek(d: Date): number {
  const thursday = new Date(utcDate(d))
  thursday.setUTCDate(thursday.getUTCDate() + 3 - ((thursday.getUTCDay() + 6) % 7))
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  return Math.floor((thursday.getTime() - jan1) / MS_PER_DAY / 7) + 1
}

export function todayISO(): string {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

// Shift a YYYY-MM-DD by whole days (noon anchor avoids DST/tz edge cases).
export function shiftISO(dateISO: string, deltaDays: number): string {
  const d = new Date(dateISO + "T12:00:00")
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// An evening reflection done in the early hours after midnight is really about
// the previous day, so before `cutoffHour` (local) we default to yesterday.
export function defaultEntryDate(cutoffHour = 4): string {
  return new Date().getHours() < cutoffHour ? shiftISO(todayISO(), -1) : todayISO()
}
