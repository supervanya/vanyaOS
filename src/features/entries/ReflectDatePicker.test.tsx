// @vitest-environment jsdom
import type { LoadedConfig } from "@/features/config/api"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { configQuery } from "@/features/config/queries"
import { trendSeriesQuery } from "@/features/trends/queries"
import { ReflectDatePicker } from "./ReflectDatePicker"

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }))
afterEach(cleanup)

const config = {
  metrics: [{ id: "mood", label: "Mood", group: "Stimulation", higherIsBetter: true, scale: 5 }],
} as LoadedConfig

function renderPicker(onSelect: (date: string) => void) {
  const client = new QueryClient()
  client.setQueryData(configQuery.queryKey, config)
  client.setQueryData(trendSeriesQuery.queryKey, {
    firstDate: "2026-11-02",
    metrics: {
      mood: [
        { date: "2026-11-02", value: 5 },
        { date: "2026-11-03", value: 3 },
        { date: "2026-11-04", value: 1 },
      ],
    },
    habits: { walk: [{ date: "2026-11-05", value: 1 }] },
  })
  render(
    <QueryClientProvider client={client}>
      <ReflectDatePicker
        date="2026-11-08"
        maxDate="2026-11-10"
        label="Sun, Nov 8"
        onSelect={onSelect}
      />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole("button", { name: /pick a date/i }))
}

// Day buttons carry their local date, as `toLocaleDateString()` renders it.
const dayButton = (iso: string) => {
  const el = document.querySelector(
    `[data-day="${new Date(iso + "T00:00:00").toLocaleDateString()}"]`,
  )
  if (!(el instanceof HTMLButtonElement)) throw new Error(`no day button for ${iso}`)
  return el
}

describe("ReflectDatePicker", () => {
  it("tones each logged day by its wellness band", () => {
    renderPicker(() => {})
    expect(dayButton("2026-11-02").dataset.tone).toBe("good")
    expect(dayButton("2026-11-03").dataset.tone).toBe("ok")
    expect(dayButton("2026-11-04").dataset.tone).toBe("bad")
    expect(dayButton("2026-11-05").dataset.tone).toBe("logged")
    expect(dayButton("2026-11-06").dataset.tone).toBeUndefined()
  })

  it("tallies the shown month", () => {
    renderPicker(() => {})
    expect(screen.getByText(/days logged/).textContent).toBe("4 of 30 days logged")
  })

  it("disables days after the max date", () => {
    renderPicker(() => {})
    expect(dayButton("2026-11-10").disabled).toBe(false)
    expect(dayButton("2026-11-11").disabled).toBe(true)
  })

  it("reports the picked day as YYYY-MM-DD", () => {
    const onSelect = vi.fn<(date: string) => void>()
    renderPicker(onSelect)
    fireEvent.click(dayButton("2026-11-03"))
    expect(onSelect).toHaveBeenCalledWith("2026-11-03")
  })
})
