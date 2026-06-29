import { Slider as SliderPrimitive } from "radix-ui"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * A tactile single-value slider built on the Radix slider primitive.
 * - thumb springs/scales under press (motion)
 * - accent-colored fill (per-metric: indigo vs rose for symptoms)
 * - a short haptic tick on each step change (Android; iOS Safari has no
 *   web vibration API, so there it's a visual-only spring)
 */
export function MetricSlider({
  value,
  min = 0,
  max = 5,
  onValueChange,
  accent = "#818cf8",
  className,
}: {
  value: number
  min?: number
  max?: number
  onValueChange: (value: number) => void
  accent?: string
  className?: string
}) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none items-center py-1.5 select-none",
        className,
      )}
      min={min}
      max={max}
      step={1}
      value={[value]}
      onValueChange={(v) => {
        const next = v[0]
        if (next === value) return
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(7)
        }
        onValueChange(next)
      }}
    >
      <SliderPrimitive.Track className="bg-foreground/15 relative h-2.5 grow overflow-hidden rounded-full">
        <SliderPrimitive.Range
          className="absolute h-full rounded-full"
          style={{ backgroundColor: accent }}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb asChild>
        <motion.div
          whileTap={{ scale: 1.3 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          className="border-background focus-visible:ring-foreground/30 block size-7 cursor-grab rounded-full border-[3px] shadow-[0_2px_10px_rgba(0,0,0,0.4)] outline-none focus-visible:ring-4 active:cursor-grabbing"
          style={{ backgroundColor: accent }}
        />
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  )
}
