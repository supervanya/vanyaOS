import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The shared page wrapper for every route: a centered, phone-width column that
 * honors the iOS safe-area insets (so the header clears the status bar and the
 * footer clears the home indicator in the installed PWA; insets are 0 in a
 * normal browser, so it looks unchanged there). Applied once in the root layout
 * so pages don't each repeat the container.
 */
export function AppShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mx-auto min-h-dvh max-w-md px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </div>
  )
}
