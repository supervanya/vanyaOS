import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import type { Dispatch, ReactNode, SetStateAction } from "react"
import {
  Activity,
  Archive,
  ArchiveRestore,
  Flag,
  Bot,
  BookOpen,
  RefreshCw,
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
  updateSortOrders,
  addMetricRow,
  addHabitRow,
  addGoalRow,
  addRetroAreaRow,
  listRetroAreas,
  getAiSettings,
  saveAiSettings,
  listProviderModels,
  AI_PROVIDERS,
} from "@/lib/storage"
import type {
  MetricRow,
  HabitRow,
  GoalRow,
  RetroArea,
  AiProvider,
  ConfigTable,
} from "@/lib/storage"
import { bySortOrder, withSortOrderSlots } from "@/lib/sortOrder"
import { DragHandle, SortableList } from "@/components/SortableList"
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
      <RetroAreasSection />
      <AiSection />
    </>
  )
}

// --- retro areas -------------------------------------------------------------

function RetroAreasSection() {
  const [rows, setRows] = useState<RetroArea[] | null>(null)
  const [label, setLabel] = useState("")

  const reload = () => listRetroAreas().then(setRows).catch(onErr)
  useEffect(() => {
    reload()
  }, [])

  if (!rows) return null
  const active = rows.filter((r) => !r.archived)
  const archived = rows.filter((r) => r.archived)

  const patch = (id: string, p: Parameters<typeof updateConfigRow>[2]) =>
    updateConfigRow("retro_areas", id, p).then(reload).catch(onErr)

  const reorder = (reordered: RetroArea[]) =>
    persistReorder("retro_areas", reordered, setRows, reload)

  const add = () => {
    const l = label.trim()
    if (!l) return
    addRetroAreaRow(l, Math.max(0, ...rows.map((r) => r.sortOrder)) + 1)
      .then(() => {
        setLabel("")
        reload()
      })
      .catch(onErr)
  }

  return (
    <section className="mt-6">
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
        <BookOpen size={14} /> Retro areas
      </p>
      <SortableList items={active} onReorder={reorder} className="flex flex-col gap-2">
        {(a) => (
          <RowShell onArchive={() => patch(a.id, { archived: true })}>
            <LabelInput value={a.label} onSave={(v) => patch(a.id, { label: v })} />
          </RowShell>
        )}
      </SortableList>
      <ArchivedList rows={archived} onRestore={(r) => patch(r.id, { archived: false })} />
      <div className="mt-3 flex items-center gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New retro area…"
          className="h-8 text-[13px]"
        />
        <Button type="button" variant="outline" size="icon-sm" aria-label="Add retro area" onClick={add}>
          <Plus />
        </Button>
      </div>
    </section>
  )
}

// --- AI provider (BYO key) ---------------------------------------------------

function AiSection() {
  const [provider, setProvider] = useState<AiProvider>("anthropic")
  const [model, setModel] = useState(AI_PROVIDERS.anthropic.models[0])
  const [key, setKey] = useState("")
  const [hasKey, setHasKey] = useState(false)
  // Which provider the STORED key belongs to — a stored Anthropic key must
  // never be silently re-labeled as an OpenAI credential by a provider switch.
  const [storedProvider, setStoredProvider] = useState<AiProvider | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  // Live catalog from the provider's own API — null until fetched; the static
  // AI_PROVIDERS list only serves as the datalist fallback.
  const [models, setModels] = useState<string[] | null>(null)
  const [fetchingModels, setFetchingModels] = useState(false)

  const fetchModels = (p: AiProvider, freshKey?: string, quiet = false) => {
    setFetchingModels(true)
    listProviderModels(freshKey ? p : undefined, freshKey || undefined)
      .then((m) => {
        setModels(m)
        if (m.length) setModel((cur) => (m.includes(cur) ? cur : m[0]))
      })
      .catch((err) => {
        setModels(null)
        if (!quiet) toast.error(`Couldn't fetch models: ${(err as Error).message}`)
      })
      .finally(() => setFetchingModels(false))
  }

  useEffect(() => {
    getAiSettings()
      .then((s) => {
        if (s) {
          setProvider(s.provider)
          setModel(s.model)
          setHasKey(s.hasKey)
          setStoredProvider(s.provider)
          // Stored key -> refresh the catalog silently in the background.
          if (s.hasKey) fetchModels(s.provider, undefined, true)
        }
        setLoaded(true)
      })
      .catch(onErr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!loaded) return null

  const storedKeyUsable = hasKey && provider === storedProvider

  const save = async () => {
    if (!storedKeyUsable && !key.trim()) {
      toast.error(`Paste your ${AI_PROVIDERS[provider].label} API key first`)
      return
    }
    setSaving(true)
    try {
      await saveAiSettings(provider, model, key.trim() || undefined)
      setHasKey(true)
      setStoredProvider(provider)
      setKey("")
      toast.success("AI settings saved")
    } catch (err) {
      onErr(err as { message: string })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-6">
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
        <Bot size={14} /> AI coach · bring your own provider
      </p>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <select
            value={provider}
            onChange={(e) => {
              const p = e.target.value as AiProvider
              setProvider(p)
              setModel(AI_PROVIDERS[p].models[0])
              setModels(null)
              // A fresh key in the box can list models pre-save; a stored key
              // can't (it may belong to the previous provider).
              if (key.trim()) fetchModels(p, key.trim())
            }}
            className="border-input bg-transparent dark:bg-input/30 h-8 rounded-md border px-2 text-[13px]"
          >
            {(Object.keys(AI_PROVIDERS) as AiProvider[]).map((p) => (
              <option key={p} value={p}>
                {AI_PROVIDERS[p].label}
              </option>
            ))}
          </select>
          {models ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="border-input bg-transparent dark:bg-input/30 h-8 min-w-0 flex-1 rounded-md border px-2 text-[13px]"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              list="ai-models"
              placeholder="model"
              className="h-8 flex-1 text-[13px]"
            />
          )}
          <datalist id="ai-models">
            {AI_PROVIDERS[provider].models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Fetch models from provider"
            disabled={fetchingModels || (!key.trim() && !storedKeyUsable)}
            onClick={() => fetchModels(provider, key.trim() || undefined)}
            className="shrink-0"
          >
            <RefreshCw className={fetchingModels ? "animate-spin" : undefined} />
          </Button>
        </div>
        <Input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={
            storedKeyUsable
              ? "API key saved — paste to replace"
              : `Paste your ${AI_PROVIDERS[provider].label} API key`
          }
          autoComplete="off"
          className="h-8 text-[13px]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={save}
          disabled={saving}
          className="self-start"
        >
          {saving ? "Saving…" : "Save AI settings"}
        </Button>
        <p className="text-muted-foreground text-[11px]">
          Your key is stored in your own account row and only ever read by the
          coach function — the app has no AI keys of its own.
        </p>
      </div>
    </section>
  )
}

// --- shared row chrome -------------------------------------------------------

// A row of a SortableList: drag handle, the row's fields, archive button.
function RowShell({ onArchive, children }: { onArchive: () => void; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <DragHandle />
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

// Persist a drag-reorder of a section's active rows. The new order shows
// immediately; only rows whose sort_order changed are written, and a failed
// write reloads the saved order.
function persistReorder<T extends { id: string; sortOrder: number }>(
  table: ConfigTable,
  reordered: T[],
  setRows: Dispatch<SetStateAction<T[] | null>>,
  reload: () => void,
) {
  const next = withSortOrderSlots(reordered)
  const byId = new Map(next.map((r) => [r.id, r]))
  setRows((cur) => cur && cur.map((r) => byId.get(r.id) ?? r).sort(bySortOrder))

  const moved = next.filter((r, i) => r.sortOrder !== reordered[i].sortOrder)
  updateSortOrders(table, moved).catch((err) => {
    onErr(err)
    reload()
  })
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

  const reorder = (reordered: MetricRow[]) =>
    persistReorder("metrics", reordered, setRows, reload)

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
      <SortableList items={active} onReorder={reorder} className="flex flex-col gap-2">
        {(m) => (
          <RowShell onArchive={() => patch(m.id, { archived: true })}>
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
        )}
      </SortableList>
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
          <Button type="button" variant="outline" size="icon-sm" aria-label="Add metric" onClick={add}>
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

  const reorder = (reordered: HabitRow[]) =>
    persistReorder("habits", reordered, setRows, reload)

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
      <SortableList items={active} onReorder={reorder} className="flex flex-col gap-2">
        {(h) => (
          <RowShell onArchive={() => patch(h.id, { archived: true })}>
            <LabelInput value={h.label} onSave={(v) => patch(h.id, { label: v })} />
          </RowShell>
        )}
      </SortableList>
      <ArchivedList rows={archived} onRestore={(r) => patch(r.id, { archived: false })} />
      <div className="mt-3 flex items-center gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New habit…"
          className="h-8 text-[13px]"
        />
        <Button type="button" variant="outline" size="icon-sm" aria-label="Add habit" onClick={add}>
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

  const reorder = (reordered: GoalRow[]) =>
    persistReorder("goals", reordered, setRows, reload)

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
      <SortableList items={active} onReorder={reorder} className="flex flex-col gap-3">
        {(g) => (
          <>
            <RowShell onArchive={() => patch(g.id, { archived: true })}>
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
          </>
        )}
      </SortableList>
      <ArchivedList rows={archived} onRestore={(r) => patch(r.id, { archived: false })} />
      <div className="mt-3 flex items-center gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New goal…"
          className="h-8 text-[13px]"
        />
        <Button type="button" variant="outline" size="icon-sm" aria-label="Add goal" onClick={add}>
          <Plus />
        </Button>
      </div>
    </section>
  )
}
