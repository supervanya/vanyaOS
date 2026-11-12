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
  metrics: [
    { id: "mood", label: "Mood", group: "G", higherIsBetter: true, scale: 5, timing: "evening" },
    { id: "sleep", label: "Sleep", group: "G", higherIsBetter: true, scale: 5, timing: "morning" },
  ],
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
      sleep: [{ date: "2026-11-06", value: 5 }], // a morning, no evening
    },
    habits: { walk: [{ date: "2026-11-05", value: 1 }] },
    intentionDates: ["2026-11-07"],
    writtenEveningDates: [],
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
    expect(dayButton("2026-11-08").dataset.tone).toBeUndefined()
  })

  it("keeps a morning-only day's tone and marks it as morning only", () => {
    renderPicker(() => {})
    expect(dayButton("2026-11-06").dataset.tone).toBe("good")
    expect(dayButton("2026-11-06").dataset.morningOnly).toBe("true")
    expect(dayButton("2026-11-06").getAttribute("aria-label")).toMatch(/, morning only$/)
    // An intention with nothing else is a logged day, also morning only.
    expect(dayButton("2026-11-07").dataset.tone).toBe("logged")
    expect(dayButton("2026-11-07").dataset.morningOnly).toBe("true")
    expect(dayButton("2026-11-02").dataset.morningOnly).toBeUndefined()
    expect(dayButton("2026-11-02").getAttribute("aria-label")).not.toMatch(/morning/)
  })

  it("tallies the shown month", () => {
    renderPicker(() => {})
    expect(screen.getByText(/days logged/).textContent).toBe("6 of 30 days logged")
    expect(screen.getByText(/morning only/).textContent).toBe(" · 2 morning only")
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
