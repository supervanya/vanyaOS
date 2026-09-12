import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState, type ReactNode } from "react"
import { LayoutDashboard, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { loadConfig, loadTrendSeries, todayISO } from "../lib/storage"
import type { LoadedConfig, TrendSeries } from "../lib/storage"
import {
  TREND_WINDOWS,
  bucketSize,
  bucketize,
  currentStreak,
  habitTrend,
  isTrendWindow,
  metricTrend,
  pointsSince,
  wellnessSeries,
  wellnessTrend,
  windowStart,
} from "../lib/trends"
import type { Point, Streak, Trend, TrendWindow } from "../lib/trends"
import { groupMetrics } from "../lib/config"
import { HabitCells } from "@/components/HabitCells"
import { Sparkline } from "@/components/Sparkline"
import { TrendReadout, trendTone } from "@/components/TrendReadout"
import { WithDetail, shortDate } from "@/components/chartHover"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/trends")({ component: Trends })

const formatScore = (value: number) => value.toFixed(1)
const formatRate = (value: number) => `${Math.round(value * 100)}%`

function Trends() {
  const [trendWindow, setTrendWindow] = useStoredWindow()
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

      <h1 className="mt-3 flex items-center gap-2 text-[15px] font-medium">
        <TrendingUp size={17} className="text-indigo-500 dark:text-indigo-300" />
        Trends
      </h1>

      {config && history && (
        <TrendSections config={config} trendWindow={trendWindow} history={history} />
      )}
    </>
  )
}

function TrendSections({
  config,
  trendWindow,
  history,
}: {
  config: LoadedConfig
  trendWindow: TrendWindow
  history: TrendSeries
}) {
  // Every chart shares one x-axis: the window, ending today.
  const today = todayISO()
  const start = windowStart(trendWindow, today) // null for all time
  const from = start ?? history.firstDate ?? today
  const axis: Axis = { from, to: today, size: bucketSize(trendWindow, from, today) }
  const wellness = pointsSince(wellnessSeries(history.metrics, config.metrics), start)

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
      {groupMetrics(config.metrics).map(({ group, metrics }) => (
        <Section
          key={group}
          title={metrics.every((m) => !m.higherIsBetter) ? `${group} · 0 is best` : group}
        >
          {metrics.map((m) => {
            const points = pointsSince(history.metrics[m.id] ?? [], start)
            return (
              <ChartedRow
                key={m.id}
                label={m.label}
                points={points}
                trend={metricTrend(points, m)}
                max={m.scale}
                axis={axis}
              />
            )
          })}
        </Section>
      ))}
      <Section title="Habits" note={<HabitLegend cellDays={axis.size} />}>
        {config.habits.map((h) => {
          // The streak counts the whole history; the cells and trend, the window.
          const all = history.habits[h.id] ?? []
          const points = pointsSince(all, start)
          const trend = habitTrend(points)
          return (
            <TrendRow
              key={h.id}
              label={h.label}
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
          )
        })}
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
const DEFAULT_WINDOW: TrendWindow = "1M"

// The chosen window survives reloads. localStorage can throw (private mode,
// blocked storage), in which case the choice just isn't remembered.
function useStoredWindow() {
  const [value, setValue] = useState<TrendWindow>(() => {
    try {
      const stored = localStorage.getItem(WINDOW_KEY)
      return isTrendWindow(stored) ? stored : DEFAULT_WINDOW
    } catch {
      return DEFAULT_WINDOW
    }
  })

  const choose = (next: TrendWindow) => {
    setValue(next)
    try {
      localStorage.setItem(WINDOW_KEY, next)
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
