import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { Layers, Flag, Repeat, Moon, Monitor, Plus, X } from "lucide-react"
import { toast } from "sonner"
import {
  loadConfig,
  loadOrInitDay,
  saveDay,
  saveDraft,
  clearDraft,
  defaultEntryDate,
  listProjects,
  addProject,
  setActiveProject,
  deleteProject,
} from "../lib/storage"
import type { DayEntry, LoadedConfig, Project } from "../lib/storage"
import { TaskBoard } from "@/components/TaskBoard"
import { HabitChip } from "@/components/HabitChip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/")({ component: Dashboard })

const SYNC_DEBOUNCE_MS = 800

// Monday of the current week, for the "week of" header.
function weekOfLabel(): string {
  const d = new Date()
  const day = d.getDay() // 0 = Sun
  d.setDate(d.getDate() - ((day + 6) % 7))
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function Dashboard() {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Layers size={17} className="text-indigo-500 dark:text-indigo-300" />
          Command center
        </span>
        <span className="text-muted-foreground text-xs">
          week of {weekOfLabel()}
        </span>
      </div>

      {/* This week's 1-3-5 (the living task list) */}
      <section className="mt-4">
        <p className="text-muted-foreground mb-2 text-xs">This week's 1-3-5</p>
        <TaskBoard />
      </section>

      <HabitsToday />
      <GoalsGlance />
      <ProjectsCard />

      {/* Nav */}
      <div className="mt-6">
        <Link
          to="/reflect"
          className="border-border bg-input/20 flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[14px] font-medium"
        >
          <Moon size={16} className="text-indigo-500 dark:text-indigo-300" />
          Evening reflection
          <span className="text-muted-foreground ml-auto">→</span>
        </Link>
      </div>

      <p className="mt-4 text-center text-[11px]">
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

// Habit chips wired to today's entry — the exact autosave pattern the
// reflection uses (draft buffer + debounced Postgres sync), so toggling here
// and there writes the same row.
function HabitsToday() {
  const [config, setConfig] = useState<LoadedConfig | null>(null)
  const [entry, setEntry] = useState<DayEntry | null>(null)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const date = defaultEntryDate()

  useEffect(() => {
    loadConfig()
      .then((c) => {
        setConfig(c)
        return loadOrInitDay(date, c).then(setEntry)
      })
      .catch((err) => toast.error(`Couldn't load habits: ${err.message}`))
  }, [date])

  useEffect(() => {
    if (!entry || !config) return
    saveDraft(entry)
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
    <section className="mt-6">
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
    <section className="mt-6">
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
    <section className="mt-6">
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
