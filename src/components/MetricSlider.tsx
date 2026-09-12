import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

const TONE = {
  success: "[&_[data-slot=slider-range]]:bg-success/60 [&_[data-slot=slider-thumb]]:border-success",
  danger: "[&_[data-slot=slider-range]]:bg-destructive/60 [&_[data-slot=slider-thumb]]:border-destructive",
}

// No value yet: no filled range, and a faded, dashed thumb resting at the start.
const UNSET =
  "[&_[data-slot=slider-range]]:opacity-0 [&_[data-slot=slider-thumb]]:border-dashed [&_[data-slot=slider-thumb]]:border-muted-foreground [&_[data-slot=slider-thumb]]:opacity-60"

// The keys the slider itself responds to; any of them sets an untouched slider.
const SLIDER_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
])

/**
 * Default shadcn slider styling (thin track, small thumb), tinted by tone:
 * success (green) for positive metrics, destructive (red) for inverted symptoms.
 * Colors come from the semantic tokens in styles.css. Haptic tick on Android.
 *
 * `value` is undefined until the slider is first set, so an untouched metric is
 * never saved. The first tap or arrow key sets it — even to `min`, which the
 * slider alone would ignore because its position wouldn't change.
 */
export function MetricSlider({
  value,
  min = 0,
  max = 5,
  onValueChange,
  tone,
  className,
}: {
  value: number | undefined
  min?: number
  max?: number
  onValueChange: (value: number) => void
  tone: "success" | "danger"
  className?: string
}) {
  const unset = value === undefined

  const set = (next: number) => {
    if (next === value) return
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(7)
    }
    onValueChange(next)
  }

  return (
    <Slider
      value={[value ?? min]}
      min={min}
      max={max}
      step={1}
      // Runs before the slider handles the same event, so a tap further along
      // the track still wins: min first, then the tapped value.
      onPointerDown={() => {
        if (unset) set(min)
      }}
      onKeyDown={(e) => {
        if (unset && SLIDER_KEYS.has(e.key)) set(min)
      }}
      onValueChange={(v) => set(v[0])}
      className={cn(unset ? UNSET : TONE[tone], className)}
    />
  )
}
