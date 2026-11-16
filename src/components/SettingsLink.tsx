import { Link } from "@tanstack/react-router"
import { Settings } from "lucide-react"

import { cn } from "@/lib/utils"

/** The Settings sections other screens link to; each is the section's anchor id. */
const SECTIONS = {
  metrics: { name: "Metric settings", empty: "No metrics yet." },
  habits: { name: "Habit settings", empty: "No habits yet." },
  goals: { name: "Goal settings", empty: "No goals yet." },
  "retro-areas": { name: "Retro area settings", empty: "No areas yet." },
}

export type SettingsSection = keyof typeof SECTIONS

/**
 * A quiet link to the Settings section that configures what a screen shows,
 * for the end of a section's header row. While that list is `empty`, a short
 * hint (`hint`, or the section's default) comes before it.
 */
export function SettingsLink({
  section,
  empty,
  hint,
  className,
}: {
  section: SettingsSection
  empty?: boolean
  hint?: string
  className?: string
}) {
  const { name, empty: defaultHint } = SECTIONS[section]
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      {empty && <span>{hint ?? defaultHint}</span>}
      <Link
        to="/settings"
        hash={section}
        aria-label={name}
        className="flex items-center gap-1 hover:text-foreground"
      >
        <Settings size={12} aria-hidden="true" />
        Settings
      </Link>
    </span>
  )
}
