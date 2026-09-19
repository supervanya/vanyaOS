import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  BookOpen,
  Flag,
  Layers,
  Moon,
  Repeat,
  Settings as SettingsIcon,
  TrendingUp,
} from "lucide-react"

import { HabitChip } from "@/components/HabitChip"
import { Skeleton } from "@/components/ui/skeleton"
import type { LoadedConfig } from "@/features/config/api"
import { configQuery } from "@/features/config/queries"
import type { LoadedDay } from "@/features/entries/api"
import { dayQuery } from "@/features/entries/queries"
import { useEntryAutosave } from "@/features/entries/useEntryAutosave"
import { ProjectsCard } from "@/features/projects/ProjectsCard"
import { projectsQuery } from "@/features/projects/queries"
import { isRetroDue } from "@/features/retro/api"
import { latestRetroDatesQuery, retroAreasQuery } from "@/features/retro/queries"
import { TaskBoard } from "@/features/tasks/TaskBoard"
import { tasksQuery } from "@/features/tasks/queries"
import { dayOfYear, defaultEntryDate, isoWeek } from "@/lib/dates"

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    // The retro "due" badge isn't worth waiting for; it fills in when ready.
    void queryClient.prefetchQuery(retroAreasQuery)
    void queryClient.prefetchQuery(latestRetroDatesQuery)
    await Promise.all([
      queryClient.ensureQueryData(configQuery),
      queryClient.ensureQueryData(tasksQuery),
      queryClient.ensureQueryData(projectsQuery),
      queryClient.ensureQueryData(dayQuery(defaultEntryDate())),
    ])
  },
  pendingComponent: DashboardSkeleton,
  component: Dashboard,
})

// Where today sits in the year, e.g. "2026 · week 37 · day 255" (ISO week).
function dateStamp(d = new Date()): string {
  return `${d.getFullYear()} · week ${isoWeek(d)} · day ${dayOfYear(d)}`
}

function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      <Header />
      <Navigation />
      <Tasks />
      <HabitsToday />
      <GoalsGlance />
      <ProjectsCard />
      <p className="text-center text-[11px]">
        <Link to="/playground" className="text-muted-foreground underline hover:text-foreground">
          Animation playground
        </Link>
      </p>
    </div>
  )
}

function Tasks() {
  /* This week's 1-3-5 (the living task list) */
  return (
    <section className="mt-4">
      <p className="mb-2 text-xs text-muted-foreground">This week's 1-3-5</p>
      <TaskBoard />
    </section>
  )
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        <Layers size={17} className="text-indigo-500 dark:text-indigo-300" />
        Command center
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">{dateStamp()}</span>
    </div>
  )
}

function Navigation() {
  return (
    <div className="flex flex-col gap-2">
      <Link
        to="/reflect"
        className="flex items-center gap-2.5 rounded-lg border border-border bg-input/20 px-4 py-3 text-[14px] font-medium"
      >
        <Moon size={16} className="text-indigo-500 dark:text-indigo-300" />
        Evening reflection
        <span className="ml-auto text-muted-foreground">→</span>
      </Link>
      <Link
        to="/trends"
        className="flex items-center gap-2.5 rounded-lg border border-border bg-input/20 px-4 py-3 text-[14px] font-medium"
      >
        <TrendingUp size={16} className="text-indigo-500 dark:text-indigo-300" />
        Trends
        <span className="ml-auto text-muted-foreground">→</span>
      </Link>
      <RetroNavCard />
      <Link
        to="/settings"
        className="flex items-center gap-2.5 rounded-lg border border-border bg-input/20 px-4 py-3 text-[14px] font-medium"
      >
        <SettingsIcon size={16} className="text-muted-foreground" />
        Settings
        <span className="ml-auto text-muted-foreground">→</span>
      </Link>
    </div>
  )
}

// Habit chips wired to today's entry — the exact autosave pattern the
// reflection uses (draft buffer + debounced Postgres sync), so toggling here
// and there writes the same row.
function HabitsToday() {
  const date = defaultEntryDate()
  const { data: config } = useSuspenseQuery(configQuery)
  const { data: day } = useSuspenseQuery(dayQuery(date))
  return <HabitChips key={date} config={config} day={day} />
}

function HabitChips({ config, day }: { config: LoadedConfig; day: LoadedDay }) {
  const { entry, setEntry } = useEntryAutosave(config, day)

  const toggleHabit = (id: string) =>
    setEntry((e) => ({
      ...e,
      habits: { ...e.habits, [id]: !e.habits[id] },
      updatedAt: new Date().toISOString(),
    }))

  return (
    <section>
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Repeat size={14} /> Habits today
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
  )
}

function GoalsGlance() {
  const { data: config } = useSuspenseQuery(configQuery)
  return (
    <section>
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Flag size={14} /> Goals
      </p>
      {config.goals.map((g) => (
        <div key={g.id} className="mb-2 flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-foreground/85">{g.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-info"
              style={{ width: `${Math.round(g.progress * 100)}%` }}
            />
          </div>
          <span className="w-12 text-right text-[11px] text-muted-foreground">
            {g.note ?? `${Math.round(g.progress * 100)}%`}
          </span>
        </div>
      ))}
    </section>
  )
}

// Retro nav card: shows how many areas are due (30+ days since last run). The
// badge is optional, so it doesn't suspend the page — it appears once loaded.
function RetroNavCard() {
  const areas = useQuery(retroAreasQuery)
  const dates = useQuery(latestRetroDatesQuery)
  const dueCount =
    areas.data && dates.data
      ? areas.data.filter((a) => !a.archived && isRetroDue(dates.data[a.id])).length
      : 0

  return (
    <Link
      to="/retro"
      className="flex items-center gap-2.5 rounded-lg border border-border bg-input/20 px-4 py-3 text-[14px] font-medium"
    >
      <BookOpen size={16} className="text-indigo-500 dark:text-indigo-300" />
      Retrospectives
      {dueCount > 0 && (
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">
          {dueCount} due
        </span>
      )}
      <span className="ml-auto text-muted-foreground">→</span>
    </Link>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-3/5" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
    </div>
  )
}
