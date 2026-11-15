import { afterEach, describe, expect, it, vi } from "vitest"
import { loadConfig } from "./api"

type Result = { data: unknown; error: { message: string } | null }
// What each table's reads return.
const rows: Record<string, unknown[]> = {}

type Query = Promise<Result> & { select: () => Query; eq: () => Query; order: () => Query }
function query(table: string): Query {
  const result = Promise.resolve({ data: rows[table] ?? [], error: null })
  const builder: Query = Object.assign(result, {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
  })
  return builder
}

vi.mock("@/lib/supabaseClient", () => ({ supabase: { from: query } }))

afterEach(() => {
  for (const table of Object.keys(rows)) delete rows[table]
})

const metricRow = (key: string, timing: string) => ({
  id: `row-${key}`,
  key,
  label: key,
  group_name: "Recovery",
  higher_is_better: true,
  scale: 5,
  timing,
  sort_order: 0,
  archived: false,
})

describe("loadConfig", () => {
  it("reads each metric's timing", async () => {
    rows.metrics = [metricRow("sleep", "morning"), metricRow("eating", "evening")]
    const config = await loadConfig()
    expect(config.metrics.map((m) => [m.id, m.timing])).toEqual([
      ["sleep", "morning"],
      ["eating", "evening"],
    ])
  })

  it("fails loudly on a timing the code doesn't know", async () => {
    rows.metrics = [metricRow("sleep", "noon")]
    await expect(loadConfig()).rejects.toThrow(/metrics\.timing "noon"/)
  })
})
