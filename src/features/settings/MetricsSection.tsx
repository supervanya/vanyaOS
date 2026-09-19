import { useSuspenseQuery } from "@tanstack/react-query"
import { Activity, Plus } from "lucide-react"
import { useState } from "react"
import { SortableList } from "@/components/SortableList"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addMetricRow, updateMetric } from "./api"
import { metricRowsQuery } from "./queries"
import { ArchivedList, LabelInput, RowShell, useRowEditing } from "./rows"

type MetricPatch = Parameters<typeof updateMetric>[1]

export function MetricsSection() {
  const { data: rows } = useSuspenseQuery(metricRowsQuery)
  const { active, archived, nextSortOrder, update, reorder, add } = useRowEditing(rows, {
    queryKey: metricRowsQuery.queryKey,
    table: "metrics",
    invalidate: ["config"],
  })
  const patch = (id: string, p: MetricPatch) => update(id, p, () => updateMetric(id, p))
  const groups = [...new Set(active.map((r) => r.groupName))]

  const [label, setLabel] = useState("")
  const [group, setGroup] = useState("")
  const [inverted, setInverted] = useState(false)

  const submit = () => {
    const l = label.trim()
    if (!l) return
    const input = {
      label: l,
      groupName: group.trim() || "Other",
      higherIsBetter: !inverted,
      sortOrder: nextSortOrder,
    }
    add(() => addMetricRow(input))
    setLabel("")
    setGroup("")
    setInverted(false)
  }

  return (
    <section className="mt-6">
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
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
            <Label
              className="shrink-0 gap-1 text-[10px] text-muted-foreground"
              title="Symptom-style: 0 is best (inverted in wellness)"
            >
              <Checkbox
                checked={!m.higherIsBetter}
                onCheckedChange={(v) => patch(m.id, { higherIsBetter: v !== true })}
                className="size-3.5"
              />
              Symptom
            </Label>
          </RowShell>
        )}
      </SortableList>
      <ArchivedList rows={archived} onRestore={(r) => patch(r.id, { archived: false })} />

      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
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
              // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- datalist options are labelled by their value
              <option key={g} value={g} />
            ))}
          </datalist>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Add metric"
            onClick={submit}
          >
            <Plus />
          </Button>
        </div>
        <Label className="gap-2 text-[11px] text-muted-foreground">
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
