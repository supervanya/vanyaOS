import { askCoach, getAiSettings } from "@/features/ai/api"
import { errorMessage } from "@/lib/errors"

// A hand-edited doc version gets the same "what changed" bullets a coach run
// writes into its <summary>, so the version history has no gaps where the
// owner edited by hand. The summary is a nicety: every failure here resolves
// to `{ summary: null, reason }` so the caller can still save the doc.

export type ManualEditSummary = { summary: string } | { summary: null; reason: string }

// Whitespace-only edits are not a new version.
export function isUnchanged(previousDoc: string, nextDoc: string): boolean {
  return previousDoc.trim() === nextDoc.trim()
}

function summarySystemPrompt(areaLabel: string): string {
  return (
    `You are the user's ${areaLabel} coach inside their personal life-OS. ` +
    `The user hand-edited their living "state of affairs" document for this area. ` +
    `Compare the previous and the new version and write a short change summary — ` +
    `what changed, what was decided, new goals — as a few terse markdown bullets. ` +
    `Report only real differences between the two versions; do not judge, advise, or invent anything. ` +
    `Respond with ONLY <summary>…</summary>.`
  )
}

function summaryRequest(previousDoc: string, nextDoc: string): string {
  return (
    `<previous_doc>\n${previousDoc.trim()}\n</previous_doc>\n\n` +
    `<new_doc>\n${nextDoc.trim()}\n</new_doc>\n\n` +
    `What changed? Respond with ONLY <summary>a short change summary as markdown bullets, a short change summary — what changed, new decisions, new goals, new actions, accomplished items</summary>.`
  )
}

export function parseSummary(text: string): string | null {
  return text.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() || null
}

export async function summarizeManualEdit(
  areaLabel: string,
  previousDoc: string,
  nextDoc: string,
): Promise<ManualEditSummary> {
  try {
    if (!(await getAiSettings())) return { summary: null, reason: "no AI provider set up" }
    const reply = await askCoach(
      summarySystemPrompt(areaLabel),
      [{ role: "user", content: summaryRequest(previousDoc, nextDoc) }],
      1024,
    )
    const summary = parseSummary(reply)
    return summary ? { summary } : { summary: null, reason: "the coach's reply had no summary" }
  } catch (err) {
    return { summary: null, reason: errorMessage(err) }
  }
}
