import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/lib/config"
import { loadConfig } from "./api"

type Result = { data: unknown; error: { message: string } | null }
// What each table's reads return; seeding's key check reads the same rows.
const rows: Record<string, unknown[]> = {}

type Query = Promise<Result> & { select: () => Query; eq: () => Query; order: () => Query }
function query(table: string): Query {
  const result = Promise.resolve({ data: rows[table] ?? [], error: null })
  const builder: Query = Object.assign(result, {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
  })
  return Object.assign(builder, { insert })
}

const { insert, user } = vi.hoisted(() => ({
  insert: vi.fn<(rows: { key: string; timing?: string }[]) => Promise<Result>>(() =>
    Promise.resolve({ data: null, error: null }),
  ),
  // Seeding is memoized per user, so each test signs in as someone new.
  user: { id: "" },
}))
vi.mock("@/lib/supabaseClient", () => ({ supabase: { from: query } }))
vi.mock("@/lib/auth", () => ({ currentUserId: () => Promise.resolve(user.id) }))

let n = 0
afterEach(() => {
  for (const table of Object.keys(rows)) delete rows[table]
  insert.mockClear()
})
const signIn = () => (user.id = `user-${++n}`)

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
    signIn()
    rows.metrics = [metricRow("sleep", "morning"), metricRow("eating", "evening")]
    const config = await loadConfig()
    expect(config.metrics.map((m) => [m.id, m.timing])).toEqual([
      ["sleep", "morning"],
      ["eating", "evening"],
    ])
  })

  it("fails loudly on a timing the code doesn't know", async () => {
    signIn()
    rows.metrics = [metricRow("sleep", "noon")]
    await expect(loadConfig()).rejects.toThrow(/metrics\.timing "noon"/)
  })

  it("seeds missing default metrics as evening ones", async () => {
    signIn()
    await loadConfig()
    const isMetric = (key: string | undefined) => DEFAULT_CONFIG.metrics.some((m) => m.id === key)
    const seeded = insert.mock.calls.map(([r]) => r).find((r) => isMetric(r[0]?.key))
    expect(seeded?.map((r) => r.timing)).toEqual(DEFAULT_CONFIG.metrics.map(() => "evening"))
  })
})
