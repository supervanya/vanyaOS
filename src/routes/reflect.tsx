import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import {
  Moon,
  Activity,
  Flag,
  Repeat,
  Lightbulb,
  Target,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react"
import type { LoadedConfig } from "@/features/config/api"
import { configQuery } from "@/features/config/queries"
import type { LoadedDay } from "@/features/entries/api"
import { dayQuery, previousWellnessQuery } from "@/features/entries/queries"
import { useEntryAutosave } from "@/features/entries/useEntryAutosave"
import { wellness } from "@/features/entries/wellness"
import { TaskBoard } from "@/features/tasks/TaskBoard"
import { groupMetrics } from "@/lib/config"
import { defaultEntryDate, shiftISO, todayISO } from "@/lib/dates"
import { MetricSlider } from "@/features/entries/MetricSlider"
import { HabitChip } from "@/components/HabitChip"
import { useAutoGrow } from "@/hooks/useAutoGrow"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/PageHeader"
import { GoalBar } from "@/components/GoalBar"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const Route = createFileRoute("/reflect")({
  // The day being edited lives in the URL (?date=YYYY-MM-DD), so the loader can
  // fetch it and back/forward step through days. No date = the default day.
  validateSearch: (search: Record<string, unknown>): { date?: string } =>
    typeof search.date === "string" && ISO_DATE.test(search.date) ? { date: search.date } : {},
  loaderDeps: ({ search }) => ({ date: search.date ?? defaultEntryDate() }),
  loader: async ({ context: { queryClient }, deps: { date } }) => {
    void queryClient.prefetchQuery(previousWellnessQuery(date))
    await Promise.all([
      queryClient.ensureQueryData(configQuery),
      queryClient.ensureQueryData(dayQuery(date)),
    ])
  },
  pendingComponent: ReflectSkeleton,
  component: Reflection,
})

function Reflection() {
  const selectedDate = Route.useSearch().date ?? defaultEntryDate()
  const navigate = Route.useNavigate()
  const { data: config } = useSuspenseQuery(configQuery)
  const { data: day } = useSuspenseQuery(dayQuery(selectedDate))
  const goTo = (date: string) =>
    void navigate({ search: date === defaultEntryDate() ? {} : { date } })
  // Keyed by date: each day gets a fresh editor seeded from its loaded entry.
  return (
    <ReflectionDay
      key={selectedDate}
      config={config}
      loaded={day}
      selectedDate={selectedDate}
      goTo={goTo}
    />
  )
}

function ReflectionDay({
  config,
  loaded,
  selectedDate,
  goTo,
}: {
  config: LoadedConfig
  loaded: LoadedDay
  selectedDate: string
  goTo: (date: string) => void
}) {
  const { entry, setEntry } = useEntryAutosave(config, loaded)
  const [showDateInfo, setShowDateInfo] = useState(false)

  // Auto-grow the reflection textarea to fit its content (no drag handle).
  const reflectionRef = useAutoGrow(entry.reflection)

  const score = wellness(entry, config)

  // Wellness of the most recent prior day, for the "vs last" delta. Optional,
  // so it doesn't hold up the page — the delta appears once it's loaded.
  const prevScore = useQuery(previousWellnessQuery(entry.date)).data ?? null

  const groups = groupMetrics(config.metrics).map((g) => ({
    ...g,
    inverted: g.metrics.every((m) => !m.higherIsBetter),
  }))

  const stamp = () => new Date().toISOString()
  const setMetric = (id: string, v: number) =>
    setEntry((e) => ({ ...e, metrics: { ...e.metrics, [id]: v }, updatedAt: stamp() }))
  const toggleHabit = (id: string) =>
    setEntry((e) => ({ ...e, habits: { ...e.habits, [id]: !e.habits[id] }, updatedAt: stamp() }))
  const setReflection = (text: string) =>
    setEntry((e) => ({ ...e, reflection: text, updatedAt: stamp() }))

  const actualToday = todayISO()
  const isPast = selectedDate < actualToday
  const prettyDate = new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  // Color-code wellness on the 0-5 scale; there's no score until a slider is set.
  const scoreColor =
    score === null
      ? "text-muted-foreground"
      : score >= 3.75
        ? "text-success"
        : score >= 2.5
          ? "text-warning"
          : "text-destructive"
  const delta = score === null || prevScore === null ? null : score - prevScore

  return (
    <>
      {/* Back to dashboard + date navigator */}
      <PageHeader>
        <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => goTo(shiftISO(selectedDate, -1))}
            className="rounded p-1 hover:text-foreground"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[88px] text-center tabular-nums">{prettyDate}</span>
          <button
            type="button"
            aria-label="Next day"
            disabled={selectedDate >= actualToday}
            onClick={() => goTo(shiftISO(selectedDate, 1))}
            className="rounded p-1 hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </PageHeader>

      {/* Past-date warning (e.g. auto-set to yesterday after midnight) */}
      {isPast && (
        <div className="mt-2">
          <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-[12px] font-medium text-warning">
            <button
              type="button"
              onClick={() => setShowDateInfo((v) => !v)}
              aria-expanded={showDateInfo}
              className="flex flex-1 items-center gap-2 text-left"
            >
              <Info size={14} className="shrink-0" />
              <span>Logging for {prettyDate}, not today.</span>
            </button>
            <button
              type="button"
              onClick={() => goTo(actualToday)}
              className="whitespace-nowrap underline"
            >
              Use today
            </button>
          </div>
          {showDateInfo && (
            <p className="mt-1 px-1 text-[11px] text-muted-foreground">
              It's the early hours after midnight, so the reflection defaults to the previous day.
              Use the ‹ › arrows to pick another date.
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
          {score === null ? "–" : score.toFixed(1)}
        </span>
        <span className="text-xs text-muted-foreground">wellness</span>
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
            {delta > 0.05 ? "▲" : delta < -0.05 ? "▼" : "—"} {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} vs last
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
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
            ) : group === "Recovery" ? (
              <Moon size={14} />
            ) : (
              <Target size={14} />
            )}
            {group}
            {inverted ? " · 0 is best" : ""}
          </p>
          {metrics.map((m) => {
            const val = entry.metrics[m.id] // undefined until you set it
            return (
              <div key={m.id} className="mb-4 flex items-center gap-3">
                <span className="w-24 shrink-0 text-[13px] text-foreground/85">{m.label}</span>
                <div className="flex-1">
                  <MetricSlider
                    value={val}
                    min={0}
                    max={m.scale}
                    tone={inverted ? "danger" : "success"}
                    onValueChange={(v) => setMetric(m.id, v)}
                  />
                  <div className="mt-1 flex justify-between px-1 text-[9px] text-muted-foreground tabular-nums">
                    {Array.from({ length: m.scale + 1 }, (_, i) => (
                      <span key={i}>{i}</span>
                    ))}
                  </div>
                </div>
                <span
                  className={`w-6 text-right text-[15px] font-semibold tabular-nums ${val === undefined ? "text-muted-foreground" : ""}`}
                >
                  {val ?? "–"}
                </span>
              </div>
            )
          })}
        </section>
      ))}

      {/* Goals */}
      <section className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Flag size={14} /> Goal check · what you're building toward
        </p>
        {config.goals.map((g) => (
          <GoalBar key={g.id} goal={g} />
        ))}
      </section>

      {/* Habits */}
      <section className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Repeat size={14} /> Habits
        </p>
        <div className="flex flex-wrap gap-2">
          {config.habits.map((h) => (
            <HabitChip
              key={h.id}
              label={h.label}
              on={entry.habits[h.id] ?? false}
              onToggle={() => toggleHabit(h.id)}
            />
          ))}
        </div>
      </section>

      {/* The week's 1-3-5, reviewed as part of the ritual — same living list
          as the dashboard (compact: no parking lot, no add row). */}
      <section className="mt-5">
        <p className="mb-2 text-xs text-muted-foreground">This week's 1-3-5</p>
        <TaskBoard compact />
      </section>

      {/* Reflection */}
      <section className="mt-5">
        <textarea
          ref={reflectionRef}
          rows={3}
          value={entry.reflection}
          onChange={(ev) => setReflection(ev.target.value)}
          placeholder="Verbal reflection: how was today? (copied out with your metrics)"
          className="w-full resize-none overflow-hidden rounded-lg border border-input bg-input/30 p-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </section>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Synced to your account · theme: {entry.theme}
      </p>
    </>
  )
}

function ReflectSkeleton() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="mt-4 h-5 w-40" />
      <Skeleton className="mt-2 h-10 w-16" />
      {[0, 1, 2].map((group) => (
        <div key={group} className="mt-6 flex flex-col gap-4">
          <Skeleton className="h-3 w-24" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-2 flex-1" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
