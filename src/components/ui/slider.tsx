import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Slider({
  className,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const { value, defaultValue } = props
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50",
        // making the slider's hit area easier to hit on touchscreens:
        // "pointer-coarse:my--11 pointer-coarse:h-11 pointer-coarse:before:absolute pointer-coarse:before:-inset-y-10",

        // Touch target: 64px tall, extends past the slider without changing layout.
        "before:absolute before:inset-x-0 before:-inset-y-4",
        // DEBUG: use to check the hit area visually.
        // "before:bg-pink-500/40",

        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"
      >
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            "block h-4 w-7 shrink-0 rounded-sm border-2 border-primary bg-white shadow-md",
            // Interaction states
            "ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden",
            "disabled:pointer-events-none disabled:opacity-50",
            // Touch devices
            "pointer-coarse:border-1.5 rounded-lg pointer-coarse:h-4 pointer-coarse:w-8",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
