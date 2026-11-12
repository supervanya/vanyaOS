import { Moon, Sun } from "lucide-react"
import { ToggleGroup } from "radix-ui"
import { isOneOf } from "@/lib/parse"
import { METRIC_TIMINGS, type MetricTiming } from "@/lib/config"

const OPTIONS = [
  { value: "morning", label: "Morning", Icon: Sun },
  { value: "evening", label: "Evening", Icon: Moon },
] satisfies { value: MetricTiming; label: string; Icon: typeof Sun }[]

/**
 * Two-way Morning / Evening switch for a metric row: which half of the day
 * asks for its slider. Icon-only to fit a phone row; each option is labelled.
 */
export function TimingToggle({
  value,
  onChange,
  metricLabel,
}: {
  value: MetricTiming
  onChange: (timing: MetricTiming) => void
  metricLabel: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix sends "" when the pressed option is tapped again; a metric always
      // has a timing, so that tap is a no-op.
      onValueChange={(v) => {
        if (isOneOf(METRIC_TIMINGS, v) && v !== value) onChange(v)
      }}
      aria-label={`When to ask ${metricLabel}`}
      className="flex shrink-0 rounded-md border border-input p-0.5"
    >
      {OPTIONS.map(({ value: option, label, Icon }) => (
        <ToggleGroup.Item
          key={option}
          value={option}
          aria-label={label}
          title={label}
          className="grid size-7 place-items-center rounded-[5px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=on]:bg-accent data-[state=on]:text-foreground"
        >
          <Icon size={14} />
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
