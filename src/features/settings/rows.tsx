// Building blocks shared by the Settings sections that edit a sortable,
// archivable list of config rows (metrics, habits, goals, retro areas).

import type { QueryKey } from "@tanstack/react-query"
import { Archive, ArchiveRestore, Plus } from "lucide-react"
import { useState, type ReactNode } from "react"
import { DragHandle } from "@/components/SortableList"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useOptimisticList } from "@/lib/optimistic"
import { bySortOrder, withSortOrderSlots } from "@/lib/sortOrder"
import { cn } from "@/lib/utils"
import { updateSortOrders, type ConfigTable } from "./api"

type EditableRow = { id: string; label: string; sortOrder: number; archived: boolean }

/**
 * Edits against one section's rows. Every change shows at once and is written
 * in the background (rolled back with a toast if it fails); afterwards
 * `invalidate` is refetched, so screens reading derived data stay current.
 */
export function useRowEditing<T extends EditableRow>(
  rows: T[],
  { queryKey, table, invalidate }: { queryKey: QueryKey; table: ConfigTable; invalidate: QueryKey },
) {
  const apply = useOptimisticList<T>(queryKey, { invalidate })
  return {
    active: rows.filter((r) => !r.archived),
    archived: rows.filter((r) => r.archived),
    nextSortOrder: Math.max(0, ...rows.map((r) => r.sortOrder)) + 1,

    update: (id: string, patch: Partial<T>, write: () => Promise<unknown>) =>
      apply((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)), write),

    // A drag-reorder of the active rows: they take over the slots they already
    // held, and only rows whose sort_order changed are written.
    reorder: (reordered: T[]) => {
      const next = withSortOrderSlots(reordered)
      const byId = new Map(next.map((r) => [r.id, r]))
      const moved = next.filter((r, i) => r.sortOrder !== reordered[i]?.sortOrder)
      apply(
        (list) => list.map((r) => byId.get(r.id) ?? r).toSorted(bySortOrder),
        () => updateSortOrders(table, moved),
      )
    },

    // New rows appear once the insert lands and the list refetches.
    add: (write: () => Promise<unknown>) => apply((list) => list, write),
  }
}

// A row of a SortableList: drag handle, the row's fields, archive button.
export function RowShell({ onArchive, children }: { onArchive: () => void; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <DragHandle />
      {children}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Archive"
        className="shrink-0 text-muted-foreground"
        onClick={onArchive}
      >
        <Archive />
      </Button>
    </div>
  )
}

type LabelInputProps = {
  value: string
  onSave: (v: string) => void
  className?: string
}

// An input that edits a label locally and persists on blur/Enter. Keyed by the
// saved value so a change from the server starts a fresh draft.
export function LabelInput(props: LabelInputProps) {
  return <LabelDraft key={props.value} {...props} />
}

function LabelDraft({ value, onSave, className }: LabelInputProps) {
  const [draft, setDraft] = useState(value)
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
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={cn("h-8 text-[13px]", className)}
    />
  )
}

export function ArchivedList<T extends { id: string; label: string }>({
  rows,
  onRestore,
}: {
  rows: T[]
  onRestore: (row: T) => void
}) {
  if (!rows.length) return null
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[11px] text-muted-foreground">
        Archived · {rows.length}
      </summary>
      <div className="mt-1.5 flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <span className="flex-1 text-[13px] text-muted-foreground line-through">{r.label}</span>
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

/** The "New …" input + add button under a section. */
export function AddRow({
  placeholder,
  label,
  onAdd,
}: {
  placeholder: string
  label: string
  onAdd: (text: string) => void
}) {
  const [text, setText] = useState("")
  const add = () => {
    const t = text.trim()
    if (!t) return
    onAdd(t)
    setText("")
  }
  return (
    <div className="mt-3 flex items-center gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder={placeholder}
        className="h-8 text-[13px]"
      />
      <Button type="button" variant="outline" size="icon-sm" aria-label={label} onClick={add}>
        <Plus />
      </Button>
    </div>
  )
}
