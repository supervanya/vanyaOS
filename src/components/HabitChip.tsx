import { useRef } from "react"
import confetti from "canvas-confetti"

import { cn } from "@/lib/utils"

/**
 * A habit chip that throws confetti from its center when completed — satisfying
 * and with no layout shift. Haptics come from an invisible native <input switch>
 * toggled through its label (iOS Taptic Engine) + navigator.vibrate (Android).
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
  const ref = useRef<HTMLLabelElement>(null)

  const handleChange = () => {
    const willComplete = !on
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(7)
    }
    onToggle()
    if (willComplete && ref.current) {
      const r = ref.current.getBoundingClientRect()
      void confetti({
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
    // The <label> is the touch target, not the switch. A native switch tracks
    // the finger itself and toggles on touchend even when the touch became a
    // scroll; a label only gets a click, which the browser withholds on scroll.
    <label
      ref={ref}
      className={cn(
        "relative inline-flex cursor-pointer touch-manipulation items-center justify-center rounded-full border px-3.5 py-2 text-[13px] transition-colors select-none has-focus-visible:ring-2 has-focus-visible:ring-ring",
        on ? "border-success/85 bg-success/15 text-success" : "border-border text-muted-foreground",
      )}
    >
      {label}
      <input
        type="checkbox"
        {...{ switch: "" }}
        checked={on}
        onChange={handleChange}
        className="pointer-events-none absolute inset-0 m-0 size-full opacity-0 [clip-path:inset(0)]"
      />
    </label>
  )
}
