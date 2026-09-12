import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import {
  Layers,
  Flag,
  Repeat,
  Moon,
  Monitor,
  Plus,
  X,
  Settings as SettingsIcon,
  BookOpen,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"
import {
  loadConfig,
  loadOrInitDay,
  defaultEntryDate,
  listProjects,
  addProject,
  setActiveProject,
  deleteProject,
  listRetroAreas,
  latestRetroDates,
  isRetroDue,
} from "../lib/storage"
import type { LoadedConfig, Project } from "../lib/storage"
import { useEntryAutosave } from "@/hooks/useEntryAutosave"
import { TaskBoard } from "@/components/TaskBoard"
import { HabitChip } from "@/components/HabitChip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { dayOfYear, isoWeek } from "@/lib/dates"

export const Route = createFileRoute("/")({ component: Dashboard })

// Where today sits in the year, e.g. "2026 · week 37 · day 255" (ISO week).
function dateStamp(d = new Date()): string {
  return `${d.getFullYear()} · week ${isoWeek(d)} · day ${dayOfYear(d)}`
}

function Dashboard() {
  return (
    <>
      <div className="gap-6 flex flex-col">
        <Header />
        <Navigation />
        <Tasks />
        <HabitsToday />
        <GoalsGlance />
        <ProjectsCard />
        <p className="text-center text-[11px]">
          <Link
            to="/playground"
            className="text-muted-foreground hover:text-foreground underline"
          >
            Animation playground
          </Link>
        </p>
      </div>
    </>
  )
}

function Tasks() {
  /* This week's 1-3-5 (the living task list) */
  return (
    <section className="mt-4">
      <p className="text-muted-foreground mb-2 text-xs">This week's 1-3-5</p>
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
      <span className="text-muted-foreground text-xs tabular-nums">
        {dateStamp()}
      </span>
    </div>
  )
}

function Navigation() {
  return (
    <div className="flex flex-col gap-2">
      <Link
        to="/reflect"
        className="border-border bg-input/20 flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[14px] font-medium"
      >
        <Moon size={16} className="text-indigo-500 dark:text-indigo-300" />
        Evening reflection
        <span className="text-muted-foreground ml-auto">→</span>
      </Link>
      <Link
        to="/trends"
        className="border-border bg-input/20 flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[14px] font-medium"
      >
        <TrendingUp
          size={16}
          className="text-indigo-500 dark:text-indigo-300"
        />
        Trends
        <span className="text-muted-foreground ml-auto">→</span>
      </Link>
      <RetroNavCard />
      <Link
        to="/settings"
        className="border-border bg-input/20 flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[14px] font-medium"
      >
        <SettingsIcon size={16} className="text-muted-foreground" />
        Settings
        <span className="text-muted-foreground ml-auto">→</span>
      </Link>
    </div>
  )
}

// Habit chips wired to today's entry — the exact autosave pattern the
// reflection uses (draft buffer + debounced Postgres sync), so toggling here
// and there writes the same row.
function HabitsToday() {
  const [config, setConfig] = useState<LoadedConfig | null>(null)
  const { entry, setEntry, load } = useEntryAutosave(config)
  const date = defaultEntryDate()

  useEffect(() => {
    loadConfig()
      .then((c) => {
        setConfig(c)
        return loadOrInitDay(date, c).then(load)
      })
      .catch((err) => toast.error(`Couldn't load habits: ${err.message}`))
  }, [date, load])

  if (!config || !entry) return null

  const toggleHabit = (id: string) =>
    setEntry((e) =>
      e
        ? {
            ...e,
            habits: { ...e.habits, [id]: !e.habits[id] },
            updatedAt: new Date().toISOString(),
          }
        : e,
    )

  return (
    <section>
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
        <Repeat size={14} /> Habits today
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
  )
}

function GoalsGlance() {
  const [config, setConfig] = useState<LoadedConfig | null>(null)

  useEffect(() => {
    loadConfig()
      .then(setConfig)
      .catch(() => {
        /* HabitsToday already surfaces config errors */
      })
  }, [])

  if (!config) return null

  return (
    <section>
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
        <Flag size={14} /> Goals
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
  )
}

// Retro nav card: shows how many areas are due (30+ days since last run).
function RetroNavCard() {
  const [dueCount, setDueCount] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([listRetroAreas(), latestRetroDates()])
      .then(([areas, dates]) => {
        const due = areas.filter(
          (a) => !a.archived && isRetroDue(dates[a.id]),
        ).length
        setDueCount(due)
      })
      .catch(() => setDueCount(0))
  }, [])

  return (
    <Link
      to="/retro"
      className="border-border bg-input/20 flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[14px] font-medium"
    >
      <BookOpen size={16} className="text-indigo-500 dark:text-indigo-300" />
      Retrospectives
      {dueCount != null && dueCount > 0 && (
        <span className="bg-warning/15 text-warning rounded-full px-2 py-0.5 text-[11px]">
          {dueCount} due
        </span>
      )}
      <span className="text-muted-foreground ml-auto">→</span>
    </Link>
  )
}

// Projects with a WIP limit of one: exactly one in progress, the rest parked.
// Tapping a parked project swaps it in (the previous active is demoted).
function ProjectsCard() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [draft, setDraft] = useState("")

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err) => toast.error(`Couldn't load projects: ${err.message}`))
  }, [])

  if (!projects) return null

  const activate = (p: Project) => {
    if (p.status === "in_progress") return
    const prev = projects
    setProjects(
      projects.map((x) => ({
        ...x,
        status: x.id === p.id ? "in_progress" : "parking_lot",
      })),
    )
    setActiveProject(p.id).catch((err) => {
      toast.error(`Didn't save: ${err.message}`)
      setProjects(prev)
    })
  }

  const remove = (p: Project) => {
    const prev = projects
    setProjects(projects.filter((x) => x.id !== p.id))
    deleteProject(p.id).catch((err) => {
      toast.error(`Didn't save: ${err.message}`)
      setProjects(prev)
    })
  }

  const submit = () => {
    const name = draft.trim()
    if (!name) return
    setDraft("")
    addProject(name)
      .then((p) => setProjects((cur) => (cur ? [...cur, p] : [p])))
      .catch((err) => toast.error(`Didn't save: ${err.message}`))
  }

  return (
    <section>
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
        <Monitor size={14} /> Projects · WIP limit 1 · tap to swap
      </p>
      <div className="flex flex-col gap-1.5">
        {projects.map((p) => {
          const active = p.status === "in_progress"
          return (
            <div
              key={p.id}
              onClick={() => activate(p)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px]",
                active
                  ? "border-info/70 bg-info/10 text-info font-medium"
                  : "border-border text-foreground/85",
              )}
            >
              {p.emoji && <span>{p.emoji}</span>}
              <span className="flex-1">{p.name}</span>
              <span
                className={cn(
                  "text-[11px]",
                  active ? "text-info" : "text-muted-foreground",
                )}
              >
                {active ? "in progress" : "parking lot"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground -mr-1.5"
                onClick={(e) => {
                  e.stopPropagation()
                  remove(p)
                }}
              >
                <X />
              </Button>
            </div>
          )
        })}
        <div className="mt-1 flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Add a project (parks it)…"
          />
          <Button type="button" variant="outline" size="icon" onClick={submit}>
            <Plus />
          </Button>
        </div>
      </div>
    </section>
  )
}
