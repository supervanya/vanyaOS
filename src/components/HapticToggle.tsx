import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * A binary toggle that fires real haptic feedback on a finger tap.
 *
 * iOS Safari has no Vibration API, but WebKit's native `<input type="checkbox"
 * switch>` buzzes the Taptic Engine when toggled by a genuine tap (this survives
 * the iOS 26.5 patch that killed the *programmatic* version). So we lay a
 * transparent, full-size native switch over the visual control — the user's tap
 * lands on it, fires the haptic, and drives `onToggle`. On Android the switch
 * gives no haptic, so we also call navigator.vibrate().
 *
 * Note: only works for discrete toggles, not sliders (a WebKit limitation).
 */
export function HapticToggle({
  checked,
  onToggle,
  ariaLabel,
  className,
  children,
}: {
  checked: boolean
  onToggle: () => void
  ariaLabel?: string
  className?: string
  children: ReactNode
}) {
  return (
    <span className={cn("relative inline-flex items-center justify-center", className)}>
      {children}
      <input
        type="checkbox"
        // boolean WebKit attribute; this is what triggers the Taptic Engine
        {...{ switch: "" }}
        checked={checked}
        aria-label={ariaLabel}
        onChange={() => {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.(7)
          }
          onToggle()
        }}
        className="absolute inset-0 m-0 size-full cursor-pointer opacity-0 [clip-path:inset(0)]"
      />
    </span>
  )
}
