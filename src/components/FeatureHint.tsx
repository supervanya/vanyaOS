import { Info } from "lucide-react"
import { useState, type ReactNode } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

// A section heading with an explanation of the feature under it. "Don't show
// again" hides the explanation on this device; the ⓘ next to the heading
// brings it back.
export function FeatureHint({
  id,
  heading,
  title,
  children,
}: {
  id: string
  heading: string
  title: string
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
    <>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
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
    </>
  )
}
