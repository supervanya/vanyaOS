// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { MetricRow } from "./api"
import { MetricsSection } from "./MetricsSection"
import { metricRowsQuery } from "./queries"

const { updateMetric } = vi.hoisted(() => ({
  updateMetric: vi.fn<(id: string, patch: object) => Promise<void>>(() => Promise.resolve()),
}))
vi.mock(import("./api"), async (importOriginal) => ({
  ...(await importOriginal()),
  updateMetric,
  listMetricRows: () => new Promise(() => {}), // refetches never land: the cache is the test's
}))
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const row = (id: string, label: string, timing: MetricRow["timing"]): MetricRow => ({
  id,
  key: id,
  label,
  groupName: "Recovery",
  higherIsBetter: true,
  scale: 5,
  timing,
  sortOrder: 0,
  archived: false,
})

function renderSection(rows: MetricRow[]) {
  const client = new QueryClient()
  client.setQueryData(metricRowsQuery.queryKey, rows)
  render(
    <QueryClientProvider client={client}>
      <MetricsSection />
    </QueryClientProvider>,
  )
  return client
}

const toggleFor = (label: string) =>
  screen.getByRole("radiogroup", { name: `When to ask ${label}` })

describe("MetricsSection timing toggle", () => {
  it("shows each metric's timing", () => {
    renderSection([row("sleep", "Sleep", "morning"), row("eating", "Eating", "evening")])
    const sleep = within(toggleFor("Sleep"))
    expect(sleep.getByRole("radio", { name: "Morning" }).getAttribute("aria-checked")).toBe("true")
    expect(sleep.getByRole("radio", { name: "Evening" }).getAttribute("aria-checked")).toBe("false")
  })

  it("moves a metric to the morning and writes it", async () => {
    const client = renderSection([row("eating", "Eating", "evening")])
    fireEvent.click(within(toggleFor("Eating")).getByRole("radio", { name: "Morning" }))

    await waitFor(() => expect(updateMetric).toHaveBeenCalledWith("eating", { timing: "morning" }))
    expect(client.getQueryData<MetricRow[]>(metricRowsQuery.queryKey)?.[0]?.timing).toBe("morning")
  })

  it("ignores a tap on the timing already set", () => {
    renderSection([row("eating", "Eating", "evening")])
    fireEvent.click(within(toggleFor("Eating")).getByRole("radio", { name: "Evening" }))
    expect(updateMetric).not.toHaveBeenCalled()
  })
})
