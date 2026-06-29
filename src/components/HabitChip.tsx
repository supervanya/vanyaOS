import { motion, AnimatePresence, useAnimationControls } from "motion/react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A habit chip that feels satisfying to complete: a spring "pop" + a checkmark
 * that springs in when you mark it done. Haptics come from an invisible native
 * <input switch> overlay (iOS Taptic Engine on tap) + navigator.vibrate (Android).
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
  const controls = useAnimationControls()

  const handleChange = () => {
    const willComplete = !on
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(7)
    }
    onToggle()
    // pop only on completion — the satisfying moment
    if (willComplete) {
      controls.start({
        scale: [1, 1.16, 1],
        transition: { duration: 0.34, ease: "easeOut" },
      })
    }
  }

  return (
    <motion.span
      animate={controls}
      className={cn(
        "relative inline-flex items-center gap-1 rounded-full border px-3.5 py-2 text-[13px] transition-colors",
        on
          ? "border-emerald-600/50 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/60 dark:text-emerald-300"
          : "text-muted-foreground border-border",
      )}
    >
      <AnimatePresence initial={false}>
        {on && (
          <motion.span
            key="check"
            initial={{ width: 0, opacity: 0, scale: 0 }}
            animate={{ width: "auto", opacity: 1, scale: 1 }}
            exit={{ width: 0, opacity: 0, scale: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="inline-flex overflow-hidden"
          >
            <Check size={14} className="shrink-0" />
          </motion.span>
        )}
      </AnimatePresence>
      {label}
      <input
        type="checkbox"
        {...{ switch: "" }}
        checked={on}
        aria-label={label}
        onChange={handleChange}
        className="absolute inset-0 m-0 size-full cursor-pointer opacity-0 [clip-path:inset(0)]"
      />
    </motion.span>
  )
}
