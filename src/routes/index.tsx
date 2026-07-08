import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Moon,
  Activity,
  Flag,
  Repeat,
  Lightbulb,
  Target,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react"
import { toast } from "sonner"
import {
  loadConfig,
  loadOrInitDay,
  listDayDates,
  loadDay,
  saveDay,
  saveDraft,
  clearDraft,
  todayISO,
  shiftISO,
  defaultEntryDate,
} from "../lib/storage"
import type { DayEntry, LoadedConfig } from "../lib/storage"
import { wellness } from "../lib/wellness"
import type { Metric } from "../lib/config"
import { MetricSlider } from "@/components/MetricSlider"
import { HabitChip } from "@/components/HabitChip"
import { HapticToggle } from "@/components/HapticToggle"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

export const Route = createFileRoute("/")({ component: Reflection })

type Scope = "tomorrow" | "week"

// How long to wait after the last edit before syncing to Postgres. The local
// draft buffer (localStorage) is written every change, instantly — this only
// debounces the network round-trip.
const SYNC_DEBOUNCE_MS = 800

function Reflection() {
  const [config, setConfig] = useState<LoadedConfig | null>(null)
  const [entry, setEntry] = useState<DayEntry | null>(null)
  const [drafts, setDrafts] = useState<Record<Scope, string>>({
    tomorrow: "",
    week: "",
  })
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    defaultEntryDate(),
  )
  const [showDateInfo, setShowDateInfo] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load config once the account is known (the root layout only renders this
  // route once a session exists).
  useEffect(() => {
    loadConfig()
      .then(setConfig)
      .catch((err) => toast.error(`Couldn't load config: ${err.message}`))
  }, [])

  // Load the entry for the selected date whenever it (or config) changes.
  useEffect(() => {
    if (!config) return
    let cancelled = false
    loadOrInitDay(selectedDate, config)
      .then((e) => {
        if (!cancelled) setEntry(e)
      })
      .catch((err) => toast.error(`Couldn't load entry: ${err.message}`))
    return () => {
      cancelled = true
    }
  }, [config, selectedDate])

  // Every change writes the local draft instantly (survives a dropped
  // connection), then syncs to Postgres after a short debounce.
  useEffect(() => {
    if (!entry) return
    saveDraft(entry)
    if (!config) return
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      saveDay(entry, config)
        .then(() => clearDraft(entry.date))
        .catch((err) => toast.error(`Sync failed, kept locally: ${err.message}`))
    }, SYNC_DEBOUNCE_MS)
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current)
    }
  }, [entry, config])

  // Auto-grow the reflection textarea to fit its content (no drag handle).
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [entry?.reflection])

  const score = useMemo(
    () => (entry && config ? wellness(entry, config) : 0),
    [entry, config],
  )

  // Wellness of the most recent prior day, for the "vs last" delta.
  const [prevScore, setPrevScore] = useState<number | null>(null)
  useEffect(() => {
    if (!config || !entry) {
      setPrevScore(null)
      return
    }
    let cancelled = false
    const date = entry.date
    listDayDates()
      .then((dates) => {
        const priors = dates.filter((d) => d < date)
        if (!priors.length) return null
        return loadDay(priors[priors.length - 1], config)
      })
      .then((p) => {
        if (!cancelled) setPrevScore(p ? wellness(p, config) : null)
      })
      .catch(() => {
        if (!cancelled) setPrevScore(null)
      })
    return () => {
      cancelled = true
    }
  }, [config, entry?.date])

  const groups = useMemo(() => {
    if (!config) return []
    const order: string[] = []
    const byGroup: Record<string, Metric[]> = {}
    for (const m of config.metrics) {
      if (!byGroup[m.group]) {
        byGroup[m.group] = []
        order.push(m.group)
      }
      byGroup[m.group].push(m)
    }
    return order.map((g) => ({
      group: g,
      metrics: byGroup[g],
      inverted: byGroup[g].every((m) => !m.higherIsBetter),
    }))
  }, [config])

  if (!config || !entry) return null

  const stamp = () => new Date().toISOString()
  const setMetric = (id: string, v: number) =>
    setEntry((e) =>
      e ? { ...e, metrics: { ...e.metrics, [id]: v }, updatedAt: stamp() } : e,
    )
  const toggleHabit = (id: string) =>
    setEntry((e) =>
      e
        ? {
            ...e,
            habits: { ...e.habits, [id]: !e.habits[id] },
            updatedAt: stamp(),
          }
        : e,
    )
  const setReflection = (text: string) =>
    setEntry((e) => (e ? { ...e, reflection: text, updatedAt: stamp() } : e))

  const addTodo = (scope: Scope) => {
    const text = drafts[scope].trim()
    if (!text) return
    setEntry((e) =>
      e
        ? {
            ...e,
            todos: {
              ...e.todos,
              [scope]: [...e.todos[scope], { text, done: false }],
            },
            updatedAt: stamp(),
          }
        : e,
    )
    setDrafts((d) => ({ ...d, [scope]: "" }))
  }
  const toggleTodo = (scope: Scope, i: number) =>
    setEntry((e) =>
      e
        ? {
            ...e,
            todos: {
              ...e.todos,
              [scope]: e.todos[scope].map((t, idx) =>
                idx === i ? { ...t, done: !t.done } : t,
              ),
            },
            updatedAt: stamp(),
          }
        : e,
    )
  const delTodo = (scope: Scope, i: number) =>
    setEntry((e) =>
      e
        ? {
            ...e,
            todos: {
              ...e.todos,
              [scope]: e.todos[scope].filter((_, idx) => idx !== i),
            },
            updatedAt: stamp(),
          }
        : e,
    )

  const actualToday = todayISO()
  const isPast = selectedDate < actualToday
  const prettyDate = new Date(selectedDate + "T00:00:00").toLocaleDateString(
    undefined,
    { weekday: "short", month: "short", day: "numeric" },
  )

  // Color-code wellness on the 0-5 scale.
  const scoreColor =
    score >= 3.75
      ? "text-success"
      : score >= 2.5
        ? "text-warning"
        : "text-destructive"
  const delta = prevScore == null ? null : score - prevScore

  return (
    <>
      {/* Brand + date navigator */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <span className="inline-block size-2 rounded-full bg-indigo-400" />
          VanyaOS
        </span>
        <div className="text-muted-foreground flex items-center gap-0.5 text-xs">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => setSelectedDate((d) => shiftISO(d, -1))}
            className="hover:text-foreground rounded p-1"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[88px] text-center tabular-nums">
            {prettyDate}
          </span>
          <button
            type="button"
            aria-label="Next day"
            disabled={selectedDate >= actualToday}
            onClick={() => setSelectedDate((d) => shiftISO(d, 1))}
            className="hover:text-foreground rounded p-1 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Past-date warning (e.g. auto-set to yesterday after midnight) */}
      {isPast && (
        <div className="mt-2">
          <div
            onClick={() => setShowDateInfo((v) => !v)}
            className="border-warning/40 bg-warning/10 text-warning flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-medium"
          >
            <Info size={14} className="shrink-0" />
            <span>Logging for {prettyDate}, not today.</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedDate(actualToday)
              }}
              className="ml-auto whitespace-nowrap underline"
            >
              Use today
            </button>
          </div>
          {showDateInfo && (
            <p className="text-muted-foreground mt-1 px-1 text-[11px]">
              It's the early hours after midnight, so the reflection defaults to
              the previous day. Use the ‹ › arrows to pick another date.
            </p>
          )}
        </div>
      )}

      <h1 className="mt-3 flex items-center gap-2 text-[15px] font-medium">
        <Moon size={17} className="text-indigo-500 dark:text-indigo-300" />
        Evening reflection
      </h1>

      {/* Wellness score + delta vs last entry */}
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={`text-4xl font-semibold tabular-nums ${scoreColor}`}>
          {score.toFixed(1)}
        </span>
        <span className="text-muted-foreground text-xs">wellness</span>
        {delta != null && (
          <span
            className={`text-xs font-medium ${
              delta > 0.05
                ? "text-success"
                : delta < -0.05
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
          >
            {delta > 0.05 ? "▲" : delta < -0.05 ? "▼" : "—"}{" "}
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} vs last
          </span>
        )}
      </div>
      <p className="text-muted-foreground mt-0.5 text-[11px]">
        symptoms inverted · theme: {entry.theme}
      </p>

      {/* Metric groups */}
      {groups.map(({ group, metrics, inverted }) => (
        <section key={group} className="mt-5">
          <p
            className={`mb-3 flex items-center gap-1.5 text-xs ${inverted ? "text-destructive" : "text-muted-foreground"}`}
          >
            {inverted ? (
              <Activity size={14} />
            ) : group === "Stimulation" ? (
              <Lightbulb size={14} />
            ) : (
              <Target size={14} />
            )}
            {group}
            {inverted ? " · 0 is best" : ""}
          </p>
          {metrics.map((m) => {
            const val = entry.metrics[m.id] ?? 0
            return (
              <div key={m.id} className="mb-4 flex items-center gap-3">
                <span className="w-24 shrink-0 text-[13px] text-foreground/85">
                  {m.label}
                </span>
                <div className="flex-1">
                  <MetricSlider
                    value={val}
                    min={0}
                    max={m.scale}
                    tone={inverted ? "danger" : "success"}
                    onValueChange={(v) => setMetric(m.id, v)}
                  />
                  <div className="text-muted-foreground mt-1 flex justify-between px-1 text-[9px] tabular-nums">
                    {Array.from({ length: m.scale + 1 }, (_, i) => (
                      <span key={i}>{i}</span>
                    ))}
                  </div>
                </div>
                <span className="w-6 text-right text-[15px] font-semibold tabular-nums">
                  {val}
                </span>
              </div>
            )
          })}
        </section>
      ))}

      {/* Goals */}
      <section className="mt-5">
        <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
          <Flag size={14} /> Goal check · what you're building toward
        </p>
        {config.goals.map((g) => (
          <div key={g.id} className="mb-2 flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-foreground/85">
              {g.label}
            </span>
            <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className="bg-info h-full rounded-full"
                style={{ width: `${Math.round(g.progress * 100)}%` }}
              />
            </div>
            <span className="text-muted-foreground w-12 text-right text-[11px]">
              {g.note ?? `${Math.round(g.progress * 100)}%`}
            </span>
          </div>
        ))}
      </section>

      {/* Habits */}
      <section className="mt-5">
        <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
          <Repeat size={14} /> Habits
        </p>
        <div className="flex flex-wrap gap-2">
          {config.habits.map((h) => (
            <HabitChip
              key={h.id}
              label={h.label}
              on={!!entry.habits[h.id]}
              onToggle={() => toggleHabit(h.id)}
            />
          ))}
        </div>
      </section>

      {/* Todos */}
      <section className="mt-5 grid grid-cols-1 gap-4">
        {(["tomorrow", "week"] as Scope[]).map((scope) => (
          <div key={scope}>
            <p className="text-muted-foreground mb-2 text-xs">
              {scope === "tomorrow" ? "Must do tomorrow" : "This week"}
            </p>
            <div className="flex flex-col gap-2">
              {entry.todos[scope].map((t, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <HapticToggle
                    checked={t.done}
                    onToggle={() => toggleTodo(scope, i)}
                    ariaLabel={t.text}
                    className="size-5 rounded-[4px]"
                  >
                    <Checkbox
                      checked={t.done}
                      tabIndex={-1}
                      className="pointer-events-none size-5"
                    />
                  </HapticToggle>
                  <span
                    className={`flex-1 text-[13px] ${t.done ? "text-muted-foreground line-through" : "text-foreground"}`}
                  >
                    {t.text}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    onClick={() => delTodo(scope, i)}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  value={drafts[scope]}
                  onChange={(ev) =>
                    setDrafts((d) => ({ ...d, [scope]: ev.target.value }))
                  }
                  onKeyDown={(ev) => ev.key === "Enter" && addTodo(scope)}
                  placeholder="Add a todo…"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => addTodo(scope)}
                >
                  <Plus />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Reflection */}
      <section className="mt-5">
        <textarea
          ref={taRef}
          rows={3}
          value={entry.reflection}
          onChange={(ev) => setReflection(ev.target.value)}
          placeholder="Verbal reflection: how was today? (copied out with your metrics)"
          className="border-input bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none overflow-hidden rounded-lg border p-3 text-base outline-none focus-visible:ring-[3px]"
        />
      </section>

      <p className="text-muted-foreground mt-3 text-center text-[11px]">
        Synced to your account · theme: {entry.theme}
      </p>
      <p className="mt-1 text-center text-[11px]">
        <Link
          to="/playground"
          className="text-muted-foreground hover:text-foreground underline"
        >
          Animation playground
        </Link>
      </p>
    </>
  )
}
