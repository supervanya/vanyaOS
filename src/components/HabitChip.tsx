import { useRef } from "react"
import confetti from "canvas-confetti"

import { cn } from "@/lib/utils"

/**
 * A habit chip that throws confetti from its center when completed — satisfying
 * and with no layout shift. Haptics come from an invisible native <input switch>
 * overlay (iOS Taptic Engine on tap) + navigator.vibrate (Android).
 */
export function HabitChip({
  label,
  on,
  onToggle,
}: {
  label: string
  on: boolean
  onToggle: () => void
}) {
  const ref = useRef<HTMLSpanElement>(null)

  const handleChange = () => {
    const willComplete = !on
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(7)
    }
    onToggle()
    if (willComplete && ref.current) {
      const r = ref.current.getBoundingClientRect()
      confetti({
        particleCount: 70,
        spread: 75,
        startVelocity: 30,
        ticks: 120,
        scalar: 0.8,
        origin: {
          x: (r.left + r.width / 2) / window.innerWidth,
          y: (r.top + r.height / 2) / window.innerHeight,
        },
      })
    }
  }

  return (
    <span
      ref={ref}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full border px-3.5 py-2 text-[13px] transition-colors",
        on
          ? "border-emerald-700/60 bg-emerald-600/20 text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "text-muted-foreground border-border",
      )}
    >
      {label}
      <input
        type="checkbox"
        {...{ switch: "" }}
        checked={on}
        aria-label={label}
        onChange={handleChange}
        className="absolute inset-0 m-0 size-full cursor-pointer opacity-0 [clip-path:inset(0)]"
      />
    </span>
  )
}
