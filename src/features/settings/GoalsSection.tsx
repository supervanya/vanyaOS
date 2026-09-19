import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Flag } from "lucide-react"
import { SortableList } from "@/components/SortableList"
import { Slider } from "@/components/ui/slider"
import { addGoalRow, updateGoal, type GoalRow } from "./api"
import { goalRowsQuery } from "./queries"
import { AddRow, ArchivedList, LabelInput, RowShell, useRowEditing } from "./rows"

type GoalPatch = Parameters<typeof updateGoal>[1]

export function GoalsSection() {
  const queryClient = useQueryClient()
  const { data: rows } = useSuspenseQuery(goalRowsQuery)
  const { active, archived, nextSortOrder, update, reorder, add } = useRowEditing(rows, {
    queryKey: goalRowsQuery.queryKey,
    table: "goals",
    invalidate: ["config"],
  })
  const patch = (id: string, p: GoalPatch) => update(id, p, () => updateGoal(id, p))

  // Slider drags fire continuously: show the value live, write it on release.
  const dragProgress = (id: string, progress: number) =>
    queryClient.setQueryData<GoalRow[]>(goalRowsQuery.queryKey, (list) =>
      list?.map((r) => (r.id === id ? { ...r, progress } : r)),
    )

  return (
    <section className="mt-6">
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
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
                onValueChange={([v]) => {
                  if (v !== undefined) dragProgress(g.id, v / 100)
                }}
                onValueCommit={([v]) => {
                  if (v !== undefined) patch(g.id, { progress: v / 100 })
                }}
                className="flex-1"
              />
              <span className="w-9 text-right text-[11px] text-muted-foreground tabular-nums">
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
      <AddRow
        placeholder="New goal…"
        label="Add goal"
        onAdd={(label) => add(() => addGoalRow(label, nextSortOrder))}
      />
    </section>
  )
}
