import { useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { recordSliderGestures } from "./sliderTrace"

const STORAGE_KEY = "playground-slider-traces-v1"
const FLAG = "[Missed drag] "
const MAX_REPORTS = 12

function readReports(): string[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]")
    return Array.isArray(saved)
      ? saved.filter((entry): entry is string => typeof entry === "string").slice(0, MAX_REPORTS)
      : []
  } catch {
    return []
  }
}

export function SliderDiagnostics({ children }: { children: ReactNode }) {
  const area = useRef<HTMLDivElement>(null)
  const [reports, setReports] = useState(readReports)
  const history = useRef(reports)
  const [copyStatus, setCopyStatus] = useState("")

  function update(next: string[]) {
    history.current = next
    setReports(next)
    setCopyStatus("")
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Still available to copy when tab storage is unavailable.
    }
  }

  useEffect(() => {
    if (!area.current) return
    return recordSliderGestures(area.current, (report) => {
      const next = [report, ...history.current]
      if (next.length > MAX_REPORTS) {
        const oldestUnmarked = next.findLastIndex((entry) => !entry.startsWith(FLAG))
        next.splice(oldestUnmarked > 0 ? oldestUnmarked : next.length - 1, 1)
      }
      update(next)
    })
  }, [])

  const latest = reports[0]
  const report = reports.join("\n\n")
  async function copy() {
    try {
      await navigator.clipboard.writeText(report)
      setCopyStatus("Copied")
    } catch {
      setCopyStatus("Select and copy the report below.")
    }
  }

  return (
    <>
      <div className="sticky top-0 z-10 space-y-1 border-b bg-background py-2">
        <p className="text-xs">Touch traces stay in this tab. After a missed drag, mark it here.</p>
        <Button
          size="sm"
          variant="outline"
          disabled={!latest || latest.startsWith(FLAG)}
          onClick={() => latest && update([FLAG + latest, ...reports.slice(1)])}
        >
          Mark last drag as missed
        </Button>
        <span className="ml-2 text-xs text-muted-foreground">{reports.length} saved</span>
        <p className="truncate text-xs text-muted-foreground">
          {latest?.split("\n", 1)[0] ?? "Waiting for a slider gesture"}
        </p>
      </div>
      <div ref={area} className="flex flex-col gap-2">
        {children}
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-medium">Gesture report</summary>
        <div className="my-2 flex gap-2">
          <Button size="sm" disabled={!latest} onClick={() => void copy()}>
            Copy report
          </Button>
          <Button size="sm" variant="outline" disabled={!latest} onClick={() => update([])}>
            Clear traces
          </Button>
          <output className="text-xs">{copyStatus}</output>
        </div>
        <textarea
          aria-label="Recorded slider gestures"
          readOnly
          value={report}
          rows={10}
          className="w-full rounded border p-2 font-mono text-xs"
        />
      </details>
    </>
  )
}
