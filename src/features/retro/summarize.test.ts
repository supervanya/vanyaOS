import { askCoach, getAiSettings } from "@/features/ai/api"
import { afterEach, describe, expect, it, vi } from "vitest"
import { isUnchanged, parseSummary, summarizeManualEdit } from "./summarize"

vi.mock("@/features/ai/api", () => ({
  askCoach: vi.fn<typeof askCoach>(),
  getAiSettings: vi.fn<typeof getAiSettings>(),
}))

const settings = { provider: "anthropic" as const, model: "claude-sonnet-5", hasKey: true }

afterEach(() => vi.resetAllMocks())

describe("isUnchanged", () => {
  it("ignores leading and trailing whitespace", () => {
    expect(isUnchanged("# Doc\n\n- a\n", "  # Doc\n\n- a")).toBe(true)
  })

  it("sees an edit inside the doc", () => {
    expect(isUnchanged("# Doc\n- a", "# Doc\n- b")).toBe(false)
  })
})

describe("parseSummary", () => {
  it("takes the trimmed <summary> block", () => {
    expect(parseSummary("Sure!\n<summary>\n- Raised the target\n</summary>")).toBe(
      "- Raised the target",
    )
  })

  it("rejects a reply without a summary block", () => {
    expect(parseSummary("- Raised the target")).toBeNull()
  })

  it("rejects an empty summary block", () => {
    expect(parseSummary("<summary>  \n</summary>")).toBeNull()
  })
})

describe("summarizeManualEdit", () => {
  it("asks the coach with both versions and returns its summary", async () => {
    vi.mocked(getAiSettings).mockResolvedValue(settings)
    vi.mocked(askCoach).mockResolvedValue("<summary>- Bench goal 100 → 110 kg</summary>")

    const result = await summarizeManualEdit("Fitness", "Bench: 100 kg", "Bench: 110 kg")

    expect(result).toEqual({ summary: "- Bench goal 100 → 110 kg" })
    const [system, messages] = vi.mocked(askCoach).mock.calls[0] ?? []
    expect(system).toContain("Fitness")
    expect(messages).toHaveLength(1)
    expect(messages?.[0]?.content).toContain("<previous_doc>\nBench: 100 kg\n</previous_doc>")
    expect(messages?.[0]?.content).toContain("<new_doc>\nBench: 110 kg\n</new_doc>")
  })

  it("skips the AI call when no provider is set up", async () => {
    vi.mocked(getAiSettings).mockResolvedValue(null)

    const result = await summarizeManualEdit("Fitness", "a", "b")

    expect(result.summary).toBeNull()
    expect(askCoach).not.toHaveBeenCalled()
  })

  it("falls back to no summary when the coach call fails", async () => {
    vi.mocked(getAiSettings).mockResolvedValue(settings)
    vi.mocked(askCoach).mockRejectedValue(new Error("rate limited"))

    expect(await summarizeManualEdit("Fitness", "a", "b")).toEqual({
      summary: null,
      reason: "rate limited",
    })
  })

  it("falls back to no summary when the settings read fails", async () => {
    vi.mocked(getAiSettings).mockRejectedValue(new Error("offline"))

    expect(await summarizeManualEdit("Fitness", "a", "b")).toEqual({
      summary: null,
      reason: "offline",
    })
  })

  it("falls back to no summary when the reply has no summary block", async () => {
    vi.mocked(getAiSettings).mockResolvedValue(settings)
    vi.mocked(askCoach).mockResolvedValue("I couldn't compare those.")

    expect((await summarizeManualEdit("Fitness", "a", "b")).summary).toBeNull()
  })
})
