import { useSuspenseQuery } from "@tanstack/react-query"
import { Repeat } from "lucide-react"
import { SortableList } from "@/components/SortableList"
import { addHabitRow, updateConfigRow, type ConfigPatch } from "./api"
import { habitRowsQuery } from "./queries"
import { AddRow, ArchivedList, LabelInput, RowShell, useRowEditing } from "./rows"

export function HabitsSection() {
  const { data: rows } = useSuspenseQuery(habitRowsQuery)
  const { active, archived, nextSortOrder, update, reorder, add } = useRowEditing(rows, {
    queryKey: habitRowsQuery.queryKey,
    table: "habits",
    invalidate: ["config"],
  })
  const patch = (id: string, p: ConfigPatch) =>
    update(id, p, () => updateConfigRow("habits", id, p))

  return (
    <section className="mt-6">
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
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
      <AddRow
        placeholder="New habit…"
        label="Add habit"
        onAdd={(label) => add(() => addHabitRow(label, nextSortOrder))}
      />
    </section>
  )
}
