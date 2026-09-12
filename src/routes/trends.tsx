import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState, type ReactNode } from "react"
import { ArrowUpDown, LayoutDashboard, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { loadConfig, loadTrendSeries, todayISO } from "../lib/storage"
import type { LoadedConfig, TrendSeries } from "../lib/storage"
import {
  SORT_ORDERS,
  TREND_WINDOWS,
  bucketSize,
  bucketize,
  currentStreak,
  habitTrend,
  isSortOrder,
  isTrendWindow,
  metricTrend,
  pointsSince,
  sortByStanding,
  standing,
  wellnessSeries,
  wellnessTrend,
  windowStart,
} from "../lib/trends"
import type { Point, SortOrder, Streak, Trend, TrendWindow } from "../lib/trends"
import { groupMetrics, type Metric } from "../lib/config"
import { HabitCells } from "@/components/HabitCells"
import { Sparkline } from "@/components/Sparkline"
import { TrendReadout, trendTone } from "@/components/TrendReadout"
import { WithDetail, shortDate } from "@/components/chartHover"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/trends")({ component: Trends })

const formatScore = (value: number) => value.toFixed(1)
const formatRate = (value: number) => `${Math.round(value * 100)}%`

function Trends() {
  const [trendWindow, setTrendWindow] = useStoredChoice(WINDOW_KEY, isTrendWindow, "1M")
  const [sortOrder, setSortOrder] = useStoredChoice(SORT_KEY, isSortOrder, "yours")
  const config = useConfig()
  const history = useTrendHistory(config)

  return (
    <>
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-semibold tracking-tight"
        >
          <LayoutDashboard size={15} />
          VanyaOS
        </Link>
        <WindowPicker value={trendWindow} onChange={setTrendWindow} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-[15px] font-medium">
          <TrendingUp size={17} className="text-indigo-500 dark:text-indigo-300" />
          Trends
        </h1>
        <SortButton value={sortOrder} onChange={setSortOrder} />
      </div>

      {config && history && (
        <TrendSections
          config={config}
          trendWindow={trendWindow}
          sortOrder={sortOrder}
          history={history}
        />
      )}
    </>
  )
}

function TrendSections({
  config,
  trendWindow,
  sortOrder,
  history,
}: {
  config: LoadedConfig
  trendWindow: TrendWindow
  sortOrder: SortOrder
  history: TrendSeries
}) {
  // Every chart shares one x-axis: the window, ending today.
  const today = todayISO()
  const start = windowStart(trendWindow, today) // null for all time
  const from = start ?? history.firstDate ?? today
  const axis: Axis = { from, to: today, size: bucketSize(trendWindow, from, today) }
  const wellness = pointsSince(wellnessSeries(history.metrics, config.metrics), start)

  const metricRows: MetricRow[] = config.metrics.map((metric) => {
    const points = pointsSince(history.metrics[metric.id] ?? [], start)
    const trend = metricTrend(points, metric)
    return { metric, points, trend, standing: standing(trend, metric.higherIsBetter, metric.scale) }
  })
  const habitRows = config.habits.map((habit) => {
    // The streak counts the whole history; the cells and trend, the window.
    const all = history.habits[habit.id] ?? []
    const points = pointsSince(all, start)
    const trend = habitTrend(points)
    return { habit, all, points, trend, standing: standing(trend, true, 1) }
  })
  const sorted = sortOrder !== "yours"

  return (
    <>
      <Section title="Overall">
        <ChartedRow
          label="Wellness"
          points={wellness}
          trend={wellnessTrend(wellness)}
          max={Math.max(1, ...config.metrics.map((m) => m.scale))}
          axis={axis}
        />
      </Section>
      {metricSections(metricRows, sortOrder).map(({ title, note, rows }) => (
        <Section key={title} title={title} note={note}>
          {rows.map(({ metric, points, trend }) => (
            <ChartedRow
              key={metric.id}
              label={metric.label}
              points={points}
              trend={trend}
              max={metric.scale}
              axis={axis}
            />
          ))}
        </Section>
      ))}
      <Section
        title={sorted ? `Habits · ${SORT_LABEL[sortOrder].toLowerCase()}` : "Habits"}
        note={
          <>
            {sorted && <SortNote>Ranked by recent completion rate.</SortNote>}
            <HabitLegend cellDays={axis.size} />
          </>
        }
      >
        {sortByStanding(habitRows, (r) => r.standing, sortOrder).map(
          ({ habit, all, points, trend }) => (
            <TrendRow
              key={habit.id}
              label={habit.label}
              trend={trend}
              format={formatRate}
              aside={<StreakCount streak={currentStreak(all)} />}
              chart={
                <HabitCells
                  buckets={bucketize(points, axis.from, axis.to, axis.size)}
                  firstDate={all[0]?.date ?? null}
                  className={trendTone(trend?.verdict)}
                />
              }
            />
          ),
        )}
      </Section>
    </>
  )
}

function WindowPicker({
  value,
  onChange,
}: {
  value: TrendWindow
  onChange: (next: TrendWindow) => void
}) {
  return (
    <div role="radiogroup" aria-label="Time window" className="bg-muted flex rounded-lg p-0.5">
      {Object.keys(TREND_WINDOWS)
        .filter(isTrendWindow)
        .map((w) => (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={w === value}
            onClick={() => onChange(w)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium",
              w === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {w}
          </button>
        ))}
    </div>
  )
}

const SORT_LABEL: Record<SortOrder, string> = {
  yours: "Your order",
  best: "Best first",
  worst: "Worst first",
}

// Shows the current order; each tap moves to the next one.
function SortButton({
  value,
  onChange,
}: {
  value: SortOrder
  onChange: (next: SortOrder) => void
}) {
  const next = SORT_ORDERS[(SORT_ORDERS.indexOf(value) + 1) % SORT_ORDERS.length]
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`Switch to ${SORT_LABEL[next].toLowerCase()}`}
      className={cn(
        "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
        value === "yours" ? "text-muted-foreground hover:text-foreground" : "bg-muted text-foreground",
      )}
    >
      <ArrowUpDown size={13} />
      <span className="sr-only">Sort: </span>
      {SORT_LABEL[value]}
    </button>
  )
}

type MetricRow = { metric: Metric; points: Point[]; trend: Trend | null; standing: number | null }

// Reflect's groups in your order. Sorted, it's one ranked list instead: a
// group of one or two metrics can't show a ranking.
function metricSections(
  rows: MetricRow[],
  order: SortOrder,
): { title: string; note: ReactNode; rows: MetricRow[] }[] {
  if (order !== "yours") {
    return [
      {
        title: `Metrics · ${SORT_LABEL[order].toLowerCase()}`,
        note: <SortNote>Ranked by your recent average; for symptoms, lower is better.</SortNote>,
        rows: sortByStanding(rows, (r) => r.standing, order),
      },
    ]
  }
  const byId = new Map(rows.map((r) => [r.metric.id, r]))
  return groupMetrics(rows.map((r) => r.metric)).map(({ group, metrics }) => ({
    title: metrics.every((m) => !m.higherIsBetter) ? `${group} · 0 is best` : group,
    note: null,
    rows: metrics.flatMap((m) => byId.get(m.id) ?? []),
  }))
}

function SortNote({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground mb-1.5 text-[11px]">{children}</p>
}

function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mt-6">
      <p className="text-muted-foreground mb-1 text-xs">{title}</p>
      {note}
      <div className="divide-border divide-y">{children}</div>
    </section>
  )
}

// Label, optional chart, readout (with an optional aside before it). The chart
// column takes whatever width is left.
function TrendRow({
  label,
  trend,
  format,
  chart,
  aside,
}: {
  label: string
  trend: Trend | null
  format: (value: number) => string
  chart?: ReactNode
  aside?: ReactNode
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-3 py-2 text-[13px]",
        chart ? "grid-cols-[6.5rem_minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]",
      )}
    >
      <span className="truncate">{label}</span>
      {chart}
      <span className="flex items-center justify-end gap-2">
        {aside}
        <TrendReadout trend={trend} format={format} />
      </span>
    </div>
  )
}

// The shared x-axis: every chart spans the same days in the same buckets.
type Axis = { from: string; to: string; size: number }

// A row with a sparkline, coloured by the row's trend.
function ChartedRow({
  label,
  points,
  trend,
  max,
  axis,
}: {
  label: string
  points: Point[]
  trend: Trend | null
  max: number
  axis: Axis
}) {
  return (
    <TrendRow
      label={label}
      trend={trend}
      format={formatScore}
      chart={
        <Sparkline
          buckets={bucketize(points, axis.from, axis.to, axis.size)}
          max={max}
          format={formatScore}
          className={trendTone(trend?.verdict)}
        />
      }
    />
  )
}

// Done days in a row up to the latest entry, e.g. "12d".
function StreakCount({ streak }: { streak: Streak }) {
  const detail = streak.since
    ? `${streak.days}-day streak, since ${shortDate(streak.since)}`
    : "No current streak"
  return (
    <WithDetail
      detail={detail}
      className={cn("text-muted-foreground text-xs tabular-nums", !streak.days && "opacity-50")}
    >
      <span className="sr-only">Current streak: </span>
      {streak.days}d
    </WithDetail>
  )
}

// Key for the habit cells and the streak count.
function HabitLegend({ cellDays }: { cellDays: number }) {
  return (
    <p className="text-muted-foreground mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      <LegendItem swatch={<span className="bg-muted-foreground size-2.5 rounded-[2px]" />} label="done" />
      <LegendItem swatch={<span className="bg-muted size-2.5 rounded-[2px]" />} label="missed" />
      <LegendItem
        swatch={<span className="bg-muted-foreground/50 mx-[3.5px] size-[3px] rounded-full" />}
        label="no entry"
      />
      <span>12d = streak</span>
      {cellDays > 1 && <span>1 cell = {cellDays === 7 ? "1 week" : `${cellDays} days`}</span>}
    </p>
  )
}

function LegendItem({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {swatch}
      {label}
    </span>
  )
}

// --- Data hooks ---------------------------------------------------------------

const WINDOW_KEY = "vanyaos:trends:window"
const SORT_KEY = "vanyaos:trends:sort"

// A choice that survives reloads. localStorage can throw (private mode, blocked
// storage), in which case it just isn't remembered; an unknown stored value
// falls back too.
function useStoredChoice<T extends string>(
  key: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return isValid(stored) ? stored : fallback
    } catch {
      return fallback
    }
  })

  const choose = (next: T) => {
    setValue(next)
    try {
      localStorage.setItem(key, next)
    } catch {
      // Not remembered, but still applied for this visit.
    }
  }

  return [value, choose] as const
}

function useConfig() {
  const [config, setConfig] = useState<LoadedConfig | null>(null)
  useEffect(() => {
    loadConfig()
      .then(setConfig)
      .catch((err) => toast.error(`Couldn't load config: ${err.message}`))
  }, [])
  return config
}

// All history is loaded once and every window is a slice of it, so switching
// windows is instant and a streak can count back past the window's start.
function useTrendHistory(config: LoadedConfig | null) {
  const [history, setHistory] = useState<TrendSeries | null>(null)

  useEffect(() => {
    if (!config) return
    let cancelled = false
    loadTrendSeries(config)
      .then((h) => {
        if (!cancelled) setHistory(h)
      })
      .catch((err) => toast.error(`Couldn't load trends: ${err.message}`))
    return () => {
      cancelled = true
    }
  }, [config])

  return history
}
