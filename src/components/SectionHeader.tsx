import { Info } from "lucide-react"
import { useState, type ReactNode } from "react"

import { SettingsLink, type SettingsSection } from "@/components/SettingsLink"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

// A section's header row (icon, heading, optional Settings link) with an
// explanation of the feature under it; `children` is the explanation's body.
// "Don't show again" hides it on this device; the ⓘ by the heading brings it back.
export function SectionHeader({
  id,
  icon,
  heading,
  title,
  settings,
  children,
}: {
  id: string
  icon: ReactNode
  heading: string
  title: string
  settings?: SettingsSection
  children: ReactNode
}) {
  const key = `vanyaos:hint-hidden:${id}`
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === "1"
    } catch {
      return false
    }
  })

  function toggle(next: boolean) {
    setHidden(next)
    try {
      if (next) localStorage.setItem(key, "1")
      else localStorage.removeItem(key)
    } catch {
      // Storage unavailable: the choice holds for this visit only.
    }
  }

  return (
    <div className="mb-2 flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {heading}
        {hidden && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`About ${heading}`}
            onClick={() => toggle(false)}
          >
            <Info />
          </Button>
        )}
        {settings && <SettingsLink section={settings} className="ml-auto" />}
      </p>
      {!hidden && (
        <Alert variant="info" role="note">
          <Info />
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>
            {children}
            <Button variant="link" size="xs" className="px-0" onClick={() => toggle(true)}>
              Don't show again
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
