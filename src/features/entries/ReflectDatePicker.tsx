import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Sun } from "lucide-react"
import { useEffect, useRef, useState, type ComponentProps } from "react"
import { labelDayButton, type DayButton } from "react-day-picker"
import { configQuery } from "@/features/config/queries"
import { trendSeriesQuery } from "@/features/trends/queries"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { dateFromISO, isoFromDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { morningOnlyDates, wellnessByDate, wellnessTone, type WellnessTone } from "./wellness"

type DayTone = WellnessTone | "logged" // "logged": saved without any slider

const TONES = ["good", "ok", "bad", "logged"] as const satisfies DayTone[]

// Per tone: the day tile, the ring that marks it selected, and the solid
// swatch used by the month bar and legend.
const TONE = {
  good: {
    label: "Good",
    tile: "bg-score-good text-score-good-foreground",
    ring: "ring-score-good-foreground",
    solid: "bg-score-good-solid",
  },
  ok: {
    label: "OK",
    tile: "bg-score-ok text-score-ok-foreground",
    ring: "ring-score-ok-foreground",
    solid: "bg-score-ok-solid",
  },
  bad: {
    label: "Rough",
    tile: "bg-score-rough text-score-rough-foreground",
    ring: "ring-score-rough-foreground",
    solid: "bg-score-rough-solid",
  },
  logged: {
    label: "No score",
    tile: "border-[1.5px] border-dashed border-muted-foreground/45",
    ring: "",
    solid: "bg-muted-foreground/30",
  },
} satisfies Record<DayTone, { label: string; tile: string; ring: string; solid: string }>

// A day tile. Its tone travels on the day's modifiers, so this stays a stable
// component rather than a closure over the scores. A day with only its morning
// keeps its tone and gets a small sun: its score rests on the morning sliders.
function ScoreDayButton({
  day,
  modifiers,
  className,
  children,
  ...props
}: ComponentProps<typeof DayButton>) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  const tone = TONES.find((t) => modifiers[t])
  const filled = tone !== undefined && tone !== "logged"
  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-tone={tone}
      data-morning-only={modifiers.morningOnly || undefined}
      className={cn(
        "relative flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium tabular-nums transition-[background-color,box-shadow,filter] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-muted-foreground/40",
        tone ? TONE[tone].tile : "text-foreground/80",
        filled ? "enabled:hover:brightness-95" : "enabled:hover:bg-accent",
        modifiers.today && "font-semibold",
        modifiers.selected &&
          (filled
            ? `font-semibold ring-2 ${TONE[tone].ring} ring-inset`
            : "border-transparent bg-foreground font-semibold text-background enabled:hover:bg-foreground"),
        className,
      )}
      {...props}
    >
      {children}
      {modifiers.morningOnly && (
        <Sun
          aria-hidden="true"
          size={9}
          strokeWidth={2.5}
          className="absolute top-1 right-1 opacity-60"
        />
      )}
      {modifiers.today && (
        <span
          aria-hidden="true"
          className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current"
        />
      )}
    </button>
  )
}

const monthKey = (d: Date) => isoFromDate(d).slice(0, 7) // YYYY-MM
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

/**
 * The Reflect date label, opening a month calendar colored by each day's
 * wellness so it's clear which days are filled out. Days after `maxDate` can't
 * be picked.
 */
export function ReflectDatePicker({
  date,
  maxDate,
  label,
  onSelect,
}: {
  date: string
  maxDate: string
  label: string
  onSelect: (date: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => firstOfMonth(dateFromISO(date)))
  const { data: config } = useSuspenseQuery(configQuery)
  // Optional: the calendar opens at once and the colors fill in when loaded.
  const series = useQuery(trendSeriesQuery).data
  const scores = series ? wellnessByDate(series, config) : new Map<string, number | null>()
  const morningOnly = series ? morningOnlyDates(series, config.metrics) : new Set<string>()

  const toneOf = (iso: string): DayTone | null => {
    if (!scores.has(iso)) return null
    const score = scores.get(iso)
    return score == null ? "logged" : wellnessTone(score)
  }
  const max = dateFromISO(maxDate)
  const atLastMonth = monthKey(month) >= monthKey(max)

  // The shown month's tally, for the bar and legend.
  const counts = { good: 0, ok: 0, bad: 0, logged: 0 } satisfies Record<DayTone, number>
  for (const iso of scores.keys()) {
    const tone = iso.startsWith(monthKey(month)) && toneOf(iso)
    if (tone) counts[tone]++
  }
  const logged = TONES.reduce((n, t) => n + counts[t], 0)
  const morningOnlyCount = [...morningOnly].filter((iso) => iso.startsWith(monthKey(month))).length
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const monthName = month.toLocaleDateString(undefined, { month: "long" })

  const pick = (iso: string) => {
    setOpen(false)
    if (iso !== date) onSelect(iso)
  }
  const shiftMonth = (delta: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setMonth(firstOfMonth(dateFromISO(date)))
        setOpen(next)
      }}
    >
      <PopoverTrigger
        aria-label={`Pick a date (${label})`}
        className="min-w-[88px] rounded px-1 py-0.5 text-center tabular-nums underline decoration-dotted underline-offset-4 hover:text-foreground"
      >
        {label}
      </PopoverTrigger>
      <PopoverContent
        align="center"
        collisionPadding={16}
        className="flex w-[min(384px,calc(100vw-2rem))] flex-col gap-4 rounded-[20px] p-5 shadow-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="pl-1 text-[17px] font-semibold tracking-tight">
            {monthName}{" "}
            <span className="font-medium text-muted-foreground">{month.getFullYear()}</span>
          </h2>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => pick(maxDate)}
              className="mr-1.5 h-8 rounded-full border px-3 text-[13px] font-medium text-foreground/80 hover:bg-accent"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="flex size-10 items-center justify-center rounded-full text-foreground/80 hover:bg-accent"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              disabled={atLastMonth}
              onClick={() => shiftMonth(1)}
              className="flex size-10 items-center justify-center rounded-full text-foreground/80 enabled:hover:bg-accent disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <Calendar
          mode="single"
          required
          selected={dateFromISO(date)}
          onSelect={(d) => pick(isoFromDate(d))}
          month={month}
          onMonthChange={setMonth}
          hideNavigation
          weekStartsOn={1}
          disabled={{ after: max }}
          endMonth={max}
          className="w-full p-0"
          formatters={{
            formatWeekdayName: (d) =>
              d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
          }}
          classNames={{
            root: "w-full",
            months: "flex flex-col",
            month: "flex w-full flex-col",
            month_caption: "sr-only",
            month_grid: "w-full border-collapse",
            weekdays: "flex gap-1.5",
            weekday:
              "flex h-6 flex-1 items-center justify-center text-xs font-medium text-muted-foreground select-none",
            week: "mt-1.5 flex w-full gap-1.5",
            day: "flex-1 p-0 select-none",
            today: "",
            outside: "opacity-40",
            disabled: "",
            hidden: "invisible",
          }}
          modifiers={{
            good: (d) => toneOf(isoFromDate(d)) === "good",
            ok: (d) => toneOf(isoFromDate(d)) === "ok",
            bad: (d) => toneOf(isoFromDate(d)) === "bad",
            logged: (d) => toneOf(isoFromDate(d)) === "logged",
            morningOnly: (d) => morningOnly.has(isoFromDate(d)),
          }}
          labels={{
            labelDayButton: (d, modifiers, options, dateLib) =>
              `${labelDayButton(d, modifiers, options, dateLib)}${modifiers.morningOnly ? ", morning only" : ""}`,
          }}
          components={{ DayButton: ScoreDayButton }}
        />

        <div className="flex flex-col gap-3 border-t pt-4 text-xs text-muted-foreground">
          {logged > 0 ? (
            <>
              <span className="flex items-center gap-1">
                <span>
                  <span className="font-semibold text-foreground tabular-nums">{logged}</span> of{" "}
                  {daysInMonth} days logged
                </span>
                {morningOnlyCount > 0 && (
                  <span className="flex items-center gap-1">
                    {" · "}
                    <Sun aria-hidden="true" size={11} strokeWidth={2.5} />
                    <span className="font-semibold text-foreground tabular-nums">
                      {morningOnlyCount}
                    </span>{" "}
                    morning only
                  </span>
                )}
              </span>
              <div className="flex h-1.5 gap-0.5" aria-hidden="true">
                {TONES.filter((t) => counts[t] > 0).map((t) => (
                  <div
                    key={t}
                    className={cn("basis-0 rounded-full", TONE[t].solid)}
                    style={{ flexGrow: counts[t] }}
                  />
                ))}
              </div>
            </>
          ) : (
            <span>Nothing logged in {monthName} yet</span>
          )}
          <div className="flex justify-between">
            {TONES.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2.5 rounded-[3px]",
                    t === "logged"
                      ? "border-[1.5px] border-dashed border-muted-foreground/60"
                      : TONE[t].solid,
                  )}
                />
                {TONE[t].label}
                <span className="font-semibold text-foreground tabular-nums">{counts[t]}</span>
              </span>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
