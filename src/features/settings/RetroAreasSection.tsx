import { useSuspenseQuery } from "@tanstack/react-query"
import { BookOpen } from "lucide-react"
import { SortableList } from "@/components/SortableList"
import { retroAreasQuery } from "@/features/retro/queries"
import { addRetroAreaRow, updateConfigRow, type ConfigPatch } from "./api"
import { AddRow, ArchivedList, EmptyHint, LabelInput, RowShell, useRowEditing } from "./rows"

export function RetroAreasSection() {
  const { data: rows } = useSuspenseQuery(retroAreasQuery)
  const { active, archived, nextSortOrder, update, reorder, add } = useRowEditing(rows, {
    queryKey: retroAreasQuery.queryKey,
    table: "retro_areas",
    invalidate: ["retro"],
  })
  const patch = (id: string, p: ConfigPatch) =>
    update(id, p, () => updateConfigRow("retro_areas", id, p))

  return (
    <section id="retro-areas" className="mt-6 scroll-mt-14">
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <BookOpen size={14} /> Retro areas
      </p>
      {!active.length && (
        <EmptyHint>None yet. Add an area of life to run retrospectives on.</EmptyHint>
      )}
      <SortableList items={active} onReorder={reorder} className="flex flex-col gap-2">
        {(a) => (
          <RowShell onArchive={() => patch(a.id, { archived: true })}>
            <LabelInput value={a.label} onSave={(v) => patch(a.id, { label: v })} />
          </RowShell>
        )}
      </SortableList>
      <ArchivedList rows={archived} onRestore={(r) => patch(r.id, { archived: false })} />
      <AddRow
        placeholder="New retro area…"
        label="Add retro area"
        onAdd={(label) => add(() => addRetroAreaRow(label, nextSortOrder))}
      />
    </section>
  )
}
