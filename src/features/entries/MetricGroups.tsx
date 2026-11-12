import { Activity, Lightbulb, Moon, Target } from "lucide-react"
import { groupMetrics, type Metric } from "@/lib/config"
import { MetricSlider } from "./MetricSlider"

/**
 * One half's sliders, bucketed by group in config order (/reflect asks the
 * evening metrics, /morning the morning ones). A group made only of symptoms
 * (lower is better) is drawn inverted: red, and labelled "0 is best".
 * `values` holds only the sliders that are set; the rest show "–".
 */
export function MetricGroups({
  metrics,
  values,
  onChange,
}: {
  metrics: Metric[]
  values: Record<string, number>
  onChange: (id: string, value: number | undefined) => void
}) {
  const groups = groupMetrics(metrics).map((g) => ({
    ...g,
    inverted: g.metrics.every((m) => !m.higherIsBetter),
  }))

  return groups.map(({ group, metrics: members, inverted }) => (
    <section key={group} className="mt-5">
      <p
        className={`mb-3 flex items-center gap-1.5 text-xs ${inverted ? "text-destructive" : "text-muted-foreground"}`}
      >
        {inverted ? (
          <Activity size={14} />
        ) : group === "Stimulation" ? (
          <Lightbulb size={14} />
        ) : group === "Recovery" ? (
          <Moon size={14} />
        ) : (
          <Target size={14} />
        )}
        {group}
        {inverted ? " · 0 is best" : ""}
      </p>
      {members.map((m) => {
        const val = values[m.id] // undefined until you set it
        return (
          <div key={m.id} className="mb-4 flex items-center gap-3">
            <span className="w-24 shrink-0 text-[13px] text-foreground/85">{m.label}</span>
            <div className="flex-1">
              <MetricSlider
                value={val}
                min={0}
                max={m.scale}
                tone={inverted ? "danger" : "success"}
                onValueChange={(v) => onChange(m.id, v)}
              />
              <div className="mt-1.5 flex justify-between px-4 text-[7px] text-muted-foreground tabular-nums select-none">
                {Array.from({ length: m.scale + 1 }, (_, i) => (
                  <span key={i}>{i}</span>
                ))}
              </div>
            </div>
            <span
              className={`w-6 text-right text-[15px] font-semibold tabular-nums ${val === undefined ? "text-muted-foreground" : ""}`}
            >
              {val ?? "–"}
            </span>
          </div>
        )
      })}
    </section>
  ))
}
