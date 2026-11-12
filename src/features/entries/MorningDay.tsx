import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { Info, Lock, Sun } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import type { LoadedConfig } from "@/features/config/api"
import { DEFAULT_MORNING_PREFS } from "@/features/settings/api"
import { morningPrefsQuery } from "@/features/settings/queries"
import { TaskBoard } from "@/features/tasks/TaskBoard"
import { useAutoGrow } from "@/hooks/useAutoGrow"
import { metricsAt } from "@/lib/config"
import { todayISO } from "@/lib/dates"
import type { LoadedMorning } from "./api"
import { DayNavigator } from "./DayNavigator"
import { inMorningWindow, morningIsSet, skipMorning } from "./landing"
import { eveningStarted } from "./lock"
import { MetricGroups } from "./MetricGroups"
import { MorningCard } from "./MorningRecap"
import { dayQuery } from "./queries"
import { useMorningAutosave } from "./useEntryAutosave"

/**
 * The morning half of one day (/morning): the intention, the morning-timed
 * sliders and the week's tasks. Starts from `loaded` and saves itself — key
 * it by date to switch days.
 *
 * Once the day's evening is started the morning is read-only and nothing is
 * saved; the task board stays live. Locked is either what the morning's read
 * found (`loaded.locked`, also set when `save_morning` refuses), or the day as
 * this session holds it: an evening written on /reflect or the dashboard
 * reaches the day's cache at once, without a refetch.
 */
export function MorningDay({
  config,
  loaded,
  selectedDate,
  goTo,
}: {
  config: LoadedConfig
  loaded: LoadedMorning
  selectedDate: string
  goTo: (date: string) => void
}) {
  // Only what's already cached: this never fetches the day.
  const { data: day } = useQuery({ ...dayQuery(selectedDate), enabled: false })
  const locked = loaded.locked || (day !== undefined && eveningStarted(day.entry, config.metrics))

  const actualToday = todayISO()
  const prettyDate = new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  return (
    <>
      <PageHeader>
        <DayNavigator
          date={selectedDate}
          maxDate={actualToday}
          label={prettyDate}
          onSelect={goTo}
        />
      </PageHeader>

      {/* Filling in a missed morning */}
      {selectedDate < actualToday && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-[12px] font-medium text-warning">
          <Info size={14} className="shrink-0" />
          <span className="flex-1">Morning of {prettyDate}, not today.</span>
          <button
            type="button"
            onClick={() => goTo(actualToday)}
            className="whitespace-nowrap underline"
          >
            Use today
          </button>
        </div>
      )}

      <h1 className="mt-3 flex items-center gap-2 text-[15px] font-medium">
        <Sun size={17} className="text-amber-500 dark:text-amber-300" />
        Morning intention
      </h1>

      {locked ? (
        <MorningCard
          morning={loaded.entry}
          config={config}
          name="Morning intention, read-only"
          heading={
            <>
              <Lock size={13} className="shrink-0" /> Read-only: the evening for this day has been
              started.
            </>
          }
        />
      ) : (
        <MorningEditor config={config} loaded={loaded} isToday={selectedDate === actualToday} />
      )}

      {/* The same living list as the dashboard and /reflect: pull today's
          tasks onto the board (compact: no parking lot, no add row). */}
      <section className="mt-5">
        <p className="mb-2 text-xs text-muted-foreground">This week's 1-3-5</p>
        <TaskBoard compact />
      </section>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">Synced to your account</p>
    </>
  )
}

// The intention and morning sliders, saving themselves. Mounted only while the
// morning is unlocked, so a locked day never drafts or syncs.
function MorningEditor({
  config,
  loaded,
  isToday,
}: {
  config: LoadedConfig
  loaded: LoadedMorning
  isToday: boolean
}) {
  const { entry, setEntry } = useMorningAutosave(config, loaded)
  const navigate = useNavigate()
  // Only decides whether "Skip today" is offered, so it isn't worth holding
  // the page for or failing it over: the defaults stand in until it loads.
  const { data: prefs = DEFAULT_MORNING_PREFS } = useQuery(morningPrefsQuery)
  const intentionRef = useAutoGrow(entry.intention)
  const morningMetrics = metricsAt(config.metrics, "morning")

  const stamp = () => new Date().toISOString()
  const setMetric = (id: string, v: number | undefined) =>
    setEntry((e) => {
      const { [id]: _, ...rest } = e.metrics
      return { ...e, metrics: v === undefined ? rest : { ...rest, [id]: v }, updatedAt: stamp() }
    })
  const setIntention = (text: string) =>
    setEntry((e) => ({ ...e, intention: text, updatedAt: stamp() }))

  return (
    <>
      <section className="mt-3">
        <textarea
          ref={intentionRef}
          rows={2}
          value={entry.intention}
          onChange={(ev) => setIntention(ev.target.value)}
          aria-label="Today's intention"
          placeholder="What's your intention for today?"
          className="w-full resize-none overflow-hidden rounded-lg border border-input bg-input/30 p-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </section>

      {morningMetrics.length > 0 ? (
        <MetricGroups metrics={morningMetrics} values={entry.metrics} onChange={setMetric} />
      ) : (
        <p className="mt-5 text-xs text-muted-foreground">
          No morning check-in yet. Switch a metric to Morning in{" "}
          <Link to="/settings" className="underline hover:text-foreground">
            Settings
          </Link>{" "}
          to ask it here.
        </p>
      )}

      {/* Only while it would matter: the app opens here until this is set. */}
      {isToday && inMorningWindow(new Date(), prefs) && !morningIsSet(entry, config.metrics) && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              skipMorning(loaded.entry.date)
              void navigate({ to: "/" })
            }}
            className="text-[13px] text-muted-foreground underline hover:text-foreground"
          >
            Skip today
          </button>
        </div>
      )}
    </>
  )
}

export function MorningSkeleton() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="mt-4 h-5 w-40" />
      <Skeleton className="mt-3 h-16 w-full" />
      <div className="mt-6 flex flex-col gap-4">
        <Skeleton className="h-3 w-24" />
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}
