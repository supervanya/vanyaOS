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
  habitTrend,
  isTrendWindow,
  metricTrend,
  windowStart,
} from "../lib/trends"
import type { Trend, TrendWindow } from "../lib/trends"
import { Sparkline } from "@/components/Sparkline"
import { TrendReadout, trendTone } from "@/components/TrendReadout"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/trends")({ component: Trends })

const formatScore = (value: number) => value.toFixed(1)
const formatRate = (value: number) => `${Math.round(value * 100)}%`

function Trends() {
  const [trendWindow, setTrendWindow] = useStoredWindow()
  const config = useConfig()
  const { loaded, loading } = useTrendSeries(config, trendWindow)

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

      {config && loaded && (
        // The previous window stays on screen, dimmed, until the new one lands.
        <div className={cn("transition-opacity", loading && "opacity-60")}>
          <TrendSections config={config} {...loaded} />
        </div>
      )}
    </>
  )
}

function TrendSections({
  config,
  trendWindow,
  series,
}: {
  config: LoadedConfig
  trendWindow: TrendWindow
  series: TrendSeries
}) {
  // Every chart shares one x-axis: the window, ending today.
  const today = todayISO()
  const from = windowStart(trendWindow, today) ?? series.firstDate ?? today
  const size = bucketSize(trendWindow, from, today)

  return (
    <>
      <Section title="Metrics">
        {config.metrics.map((m) => {
          const points = series.metrics[m.id] ?? []
          const trend = metricTrend(points, m)
          return (
            <TrendRow
              key={m.id}
              label={m.label}
              trend={trend}
              format={formatScore}
              chart={
                <Sparkline
                  buckets={bucketize(points, from, today, size)}
                  max={m.scale}
                  format={formatScore}
                  className={trendTone(trend?.verdict)}
                />
              }
            />
          )
        })}
      </Section>
      <Section title="Habits">
        {config.habits.map((h) => (
          <TrendRow
            key={h.id}
            label={h.label}
            trend={habitTrend(series.habits[h.id] ?? [])}
            format={formatRate}
          />
        ))}
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <p className="text-muted-foreground mb-1 text-xs">{title}</p>
      <div className="divide-border divide-y">{children}</div>
    </section>
  )
}

// Label, optional chart, readout. The chart column takes whatever width is left.
function TrendRow({
  label,
  trend,
  format,
  chart,
}: {
  label: string
  trend: Trend | null
  format: (value: number) => string
  chart?: ReactNode
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
      <TrendReadout trend={trend} format={format} />
    </div>
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

// The series is kept together with the window it was fetched for, so what's on
// screen stays self-consistent while the next window loads.
function useTrendSeries(config: LoadedConfig | null, trendWindow: TrendWindow) {
  const [loaded, setLoaded] = useState<{ trendWindow: TrendWindow; series: TrendSeries } | null>(
    null,
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!config) return
    let cancelled = false
    setLoading(true)
    loadTrendSeries(windowStart(trendWindow, todayISO()), config)
      .then((series) => {
        if (!cancelled) setLoaded({ trendWindow, series })
      })
      .catch((err) => toast.error(`Couldn't load trends: ${err.message}`))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [config, trendWindow])

  return { loaded, loading }
}
