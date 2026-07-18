import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import {
  Activity,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Flag,
  LayoutDashboard,
  Plus,
  Repeat,
} from "lucide-react"
import { toast } from "sonner"

import {
  listMetricRows,
  listHabitRows,
  listGoalRows,
  updateConfigRow,
  addMetricRow,
  addHabitRow,
  addGoalRow,
} from "@/lib/storage"
import type { MetricRow, HabitRow, GoalRow } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/settings")({ component: Settings })

const onErr = (err: { message: string }) => toast.error(`Didn't save: ${err.message}`)

function Settings() {
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
        <span className="text-muted-foreground text-xs">Settings</span>
      </div>

      <h1 className="mt-3 text-[15px] font-medium">Setup</h1>
      <p className="text-muted-foreground mt-0.5 text-[11px]">
        Archive instead of delete — history keeps its data. Changes apply
        immediately everywhere.
      </p>

      <MetricsSection />
      <HabitsSection />
      <GoalsSection />
    </>
  )
}

// --- shared row chrome -------------------------------------------------------

function RowShell({
  onUp,
  onDown,
  onArchive,
  children,
}: {
  onUp?: () => void
  onDown?: () => void
  onArchive: () => void
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex flex-col">
        <button
          type="button"
          aria-label="Move up"
          disabled={!onUp}
          onClick={onUp}
          className="text-muted-foreground hover:text-foreground disabled:opacity-20"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          aria-label="Move down"
          disabled={!onDown}
          onClick={onDown}
          className="text-muted-foreground hover:text-foreground disabled:opacity-20"
        >
          <ChevronDown size={14} />
        </button>
      </div>
      {children}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Archive"
        className="text-muted-foreground shrink-0"
        onClick={onArchive}
      >
        <Archive />
      </Button>
    </div>
  )
}

// An input that edits a label locally and persists on blur/Enter.
function LabelInput({
  value,
  onSave,
  className,
}: {
  value: string
  onSave: (v: string) => void
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    const v = draft.trim()
    if (v && v !== value) onSave(v)
    else setDraft(value)
  }
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn("h-8 text-[13px]", className)}
    />
  )
}

function ArchivedList<T extends { id: string; label: string }>({
  rows,
  onRestore,
}: {
  rows: T[]
  onRestore: (row: T) => void
}) {
  if (!rows.length) return null
  return (
    <details className="mt-2">
      <summary className="text-muted-foreground cursor-pointer text-[11px]">
        Archived · {rows.length}
      </summary>
      <div className="mt-1.5 flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <span className="text-muted-foreground flex-1 text-[13px] line-through">
              {r.label}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Restore"
              className="text-muted-foreground"
              onClick={() => onRestore(r)}
            >
              <ArchiveRestore />
            </Button>
          </div>
        ))}
      </div>
    </details>
  )
}

// Reorder helper: swap sort_order with the neighbor among ACTIVE rows.
// Returns the two [id, newSortOrder] writes, or null at a boundary.
function swapWith<T extends { id: string; sortOrder: number }>(
  active: T[],
  index: number,
  delta: -1 | 1,
): [T, T] | null {
  const other = index + delta
  if (other < 0 || other >= active.length) return null
  return [active[index], active[other]]
}

// --- metrics -----------------------------------------------------------------

function MetricsSection() {
  const [rows, setRows] = useState<MetricRow[] | null>(null)
  const [label, setLabel] = useState("")
  const [group, setGroup] = useState("")
  const [inverted, setInverted] = useState(false)

  const reload = () => listMetricRows().then(setRows).catch(onErr)
  useEffect(() => {
    reload()
  }, [])

  if (!rows) return null
  const active = rows.filter((r) => !r.archived)
  const archived = rows.filter((r) => r.archived)
  const groups = [...new Set(active.map((r) => r.groupName))]

  const patch = (id: string, p: Parameters<typeof updateConfigRow>[2]) => {
    updateConfigRow("metrics", id, p).then(reload).catch(onErr)
  }

  const move = (i: number, delta: -1 | 1) => {
    const pair = swapWith(active, i, delta)
    if (!pair) return
    const [a, b] = pair
    Promise.all([
      updateConfigRow("metrics", a.id, { sortOrder: b.sortOrder }),
      updateConfigRow("metrics", b.id, { sortOrder: a.sortOrder }),
    ])
      .then(reload)
      .catch(onErr)
  }

  const add = () => {
    const l = label.trim()
    if (!l) return
    const maxOrder = Math.max(0, ...rows.map((r) => r.sortOrder))
    addMetricRow({
      label: l,
      groupName: group.trim() || "Other",
      higherIsBetter: !inverted,
      sortOrder: maxOrder + 1,
    })
      .then(() => {
        setLabel("")
        setGroup("")
        setInverted(false)
        reload()
      })
      .catch(onErr)
  }

  return (
    <section className="mt-6">
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
        <Activity size={14} /> Metrics
      </p>
      <div className="flex flex-col gap-2">
        {active.map((m, i) => (
          <RowShell
            key={m.id}
            onUp={i > 0 ? () => move(i, -1) : undefined}
            onDown={i < active.length - 1 ? () => move(i, 1) : undefined}
            onArchive={() => patch(m.id, { archived: true })}
          >
            <LabelInput value={m.label} onSave={(v) => patch(m.id, { label: v })} />
            <LabelInput
              value={m.groupName}
              onSave={(v) => patch(m.id, { groupName: v })}
              className="w-24 shrink-0"
            />
            {!m.higherIsBetter && (
              <span className="text-destructive shrink-0 text-[10px]">0 best</span>
            )}
          </RowShell>
        ))}
      </div>
      <ArchivedList rows={archived} onRestore={(r) => patch(r.id, { archived: false })} />

      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="New metric…"
            className="h-8 text-[13px]"
          />
          <Input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="Group"
            list="metric-groups"
            className="h-8 w-28 shrink-0 text-[13px]"
          />
          <datalist id="metric-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <Button type="button" variant="outline" size="icon-sm" onClick={add}>
            <Plus />
          </Button>
        </div>
        <Label className="text-muted-foreground gap-2 text-[11px]">
          <Checkbox
            checked={inverted}
            onCheckedChange={(v) => setInverted(v === true)}
            className="size-4"
          />
          Symptom-style: 0 is best (inverted in wellness)
        </Label>
      </div>
    </section>
  )
}

// --- habits ------------------------------------------------------------------

function HabitsSection() {
  const [rows, setRows] = useState<HabitRow[] | null>(null)
  const [label, setLabel] = useState("")

  const reload = () => listHabitRows().then(setRows).catch(onErr)
  useEffect(() => {
    reload()
  }, [])

  if (!rows) return null
  const active = rows.filter((r) => !r.archived)
  const archived = rows.filter((r) => r.archived)

  const patch = (id: string, p: Parameters<typeof updateConfigRow>[2]) =>
    updateConfigRow("habits", id, p).then(reload).catch(onErr)

  const move = (i: number, delta: -1 | 1) => {
    const pair = swapWith(active, i, delta)
    if (!pair) return
    const [a, b] = pair
    Promise.all([
      updateConfigRow("habits", a.id, { sortOrder: b.sortOrder }),
      updateConfigRow("habits", b.id, { sortOrder: a.sortOrder }),
    ])
      .then(reload)
      .catch(onErr)
  }

  const add = () => {
    const l = label.trim()
    if (!l) return
    addHabitRow(l, Math.max(0, ...rows.map((r) => r.sortOrder)) + 1)
      .then(() => {
        setLabel("")
        reload()
      })
      .catch(onErr)
  }

  return (
    <section className="mt-6">
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
        <Repeat size={14} /> Habits
      </p>
      <div className="flex flex-col gap-2">
        {active.map((h, i) => (
          <RowShell
            key={h.id}
            onUp={i > 0 ? () => move(i, -1) : undefined}
            onDown={i < active.length - 1 ? () => move(i, 1) : undefined}
            onArchive={() => patch(h.id, { archived: true })}
          >
            <LabelInput value={h.label} onSave={(v) => patch(h.id, { label: v })} />
          </RowShell>
        ))}
      </div>
      <ArchivedList rows={archived} onRestore={(r) => patch(r.id, { archived: false })} />
      <div className="mt-3 flex items-center gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New habit…"
          className="h-8 text-[13px]"
        />
        <Button type="button" variant="outline" size="icon-sm" onClick={add}>
          <Plus />
        </Button>
      </div>
    </section>
  )
}

// --- goals -------------------------------------------------------------------

function GoalsSection() {
  const [rows, setRows] = useState<GoalRow[] | null>(null)
  const [label, setLabel] = useState("")

  const reload = () => listGoalRows().then(setRows).catch(onErr)
  useEffect(() => {
    reload()
  }, [])

  if (!rows) return null
  const active = rows.filter((r) => !r.archived)
  const archived = rows.filter((r) => r.archived)

  const patch = (id: string, p: Parameters<typeof updateConfigRow>[2]) =>
    updateConfigRow("goals", id, p).then(reload).catch(onErr)

  // Slider drags fire continuously; update local state live, persist on commit.
  const setProgressLocal = (id: string, v: number) =>
    setRows((cur) => (cur ? cur.map((r) => (r.id === id ? { ...r, progress: v } : r)) : cur))

  const move = (i: number, delta: -1 | 1) => {
    const pair = swapWith(active, i, delta)
    if (!pair) return
    const [a, b] = pair
    Promise.all([
      updateConfigRow("goals", a.id, { sortOrder: b.sortOrder }),
      updateConfigRow("goals", b.id, { sortOrder: a.sortOrder }),
    ])
      .then(reload)
      .catch(onErr)
  }

  const add = () => {
    const l = label.trim()
    if (!l) return
    addGoalRow(l, Math.max(0, ...rows.map((r) => r.sortOrder)) + 1)
      .then(() => {
        setLabel("")
        reload()
      })
      .catch(onErr)
  }

  return (
    <section className="mt-6">
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
        <Flag size={14} /> Goals
      </p>
      <div className="flex flex-col gap-3">
        {active.map((g, i) => (
          <div key={g.id}>
            <RowShell
              onUp={i > 0 ? () => move(i, -1) : undefined}
              onDown={i < active.length - 1 ? () => move(i, 1) : undefined}
              onArchive={() => patch(g.id, { archived: true })}
            >
              <LabelInput value={g.label} onSave={(v) => patch(g.id, { label: v })} />
            </RowShell>
            <div className="mt-1.5 ml-6 flex items-center gap-3">
              <Slider
                value={[Math.round(g.progress * 100)]}
                min={0}
                max={100}
                step={5}
                onValueChange={([v]) => setProgressLocal(g.id, v / 100)}
                onValueCommit={([v]) => patch(g.id, { progress: v / 100 })}
                className="flex-1"
              />
              <span className="text-muted-foreground w-9 text-right text-[11px] tabular-nums">
                {Math.round(g.progress * 100)}%
              </span>
              <LabelInput
                value={g.note ?? ""}
                onSave={(v) => patch(g.id, { note: v || null })}
                className="w-20 shrink-0"
              />
            </div>
          </div>
        ))}
      </div>
      <ArchivedList rows={archived} onRestore={(r) => patch(r.id, { archived: false })} />
      <div className="mt-3 flex items-center gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New goal…"
          className="h-8 text-[13px]"
        />
        <Button type="button" variant="outline" size="icon-sm" onClick={add}>
          <Plus />
        </Button>
      </div>
    </section>
  )
}
