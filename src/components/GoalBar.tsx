import type { Goal } from "@/lib/config"

/** One goal as a labelled progress bar; the note, if any, replaces the %. */
export function GoalBar({ goal }: { goal: Goal }) {
  const percent = Math.round(goal.progress * 100)
  return (
    <div className="mb-2 flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-foreground/85">{goal.label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-info" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-12 text-right text-[11px] text-muted-foreground">
        {goal.note ?? `${percent}%`}
      </span>
    </div>
  )
}
