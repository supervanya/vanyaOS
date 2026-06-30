import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

/**
 * Default shadcn slider styling (thin track, small thumb), tinted by tone:
 * success (green) for positive metrics, destructive (red) for inverted symptoms.
 * Colors come from the semantic tokens in styles.css. Haptic tick on Android.
 */
export function MetricSlider({
  value,
  min = 0,
  max = 5,
  onValueChange,
  tone,
  className,
}: {
  value: number
  min?: number
  max?: number
  onValueChange: (value: number) => void
  tone: "success" | "destructive"
  className?: string
}) {
  return (
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={1}
      onValueChange={(v) => {
        if (v[0] === value) return
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(7)
        }
        onValueChange(v[0])
      }}
      className={cn(
        `
        [&_[data-slot=slider-range]]:bg-${tone}/60 
        [&_[data-slot=slider-thumb]]:border-${tone}
        `,
        className,
      )}
    />
  )
}
