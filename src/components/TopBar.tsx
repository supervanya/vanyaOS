import { Check, Cloud, CloudOff, CloudUpload } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { useSaveState, type SaveState } from "@/lib/saveStatus"

/**
 * The sticky top row of every screen: the screen's own header on the left,
 * the cloud-save indicator on the right. Solid background so content scrolls
 * under it. It cancels AppShell's top padding with a negative margin and
 * takes the same padding on itself, so when stuck at the top it still clears
 * the iOS status bar in the installed PWA.
 */
export function TopBar({ children }: { children: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 -mt-[max(1.25rem,env(safe-area-inset-top))] bg-background px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center justify-between">{children}</div>
        <SaveIndicator />
      </div>
    </header>
  )
}

const STATES: Record<SaveState, { icon: ReactNode; label: string; className: string }> = {
  idle: {
    icon: <Cloud size={14} />,
    label: "All changes saved",
    className: "text-muted-foreground/40",
  },
  saving: {
    icon: <CloudUpload size={14} className="animate-pulse" />,
    label: "Saving…",
    className: "text-muted-foreground",
  },
  saved: {
    icon: <Check size={14} />,
    label: "Saved",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  failed: {
    icon: <CloudOff size={14} />,
    label: "Not synced — kept on this device",
    className: "text-destructive",
  },
}

/**
 * A fixed-size icon, so state changes never shift the header's controls. The
 * words for anything worth reading sit just left of it, over the bar, while
 * there is something to say. They stay inside the bar's box on purpose: drawn
 * outside a sticky header (hanging below it), Chrome left a stale "Saved"
 * frame on screen after the DOM had already gone idle.
 */
function SaveIndicator() {
  const state = useSaveState()
  const { icon, label, className } = STATES[state]
  const short = state === "failed" ? "Not synced" : label
  return (
    <output aria-label={label} title={label} className="relative flex size-4 shrink-0">
      <span className={cn("flex size-4 items-center justify-center transition-colors", className)}>
        {icon}
      </span>
      {state !== "idle" && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 right-full mr-1.5 -translate-y-1/2 rounded-full border bg-background px-2 py-0.5 text-[11px] whitespace-nowrap",
            className,
          )}
        >
          {short}
        </span>
      )}
    </output>
  )
}
