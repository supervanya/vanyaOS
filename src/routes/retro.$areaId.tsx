import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Pencil, Play, Send, Square } from "lucide-react"
import { toast } from "sonner"

import {
  listRetroAreas,
  latestRetro,
  latestCoachRunAt,
  saveRetroVersion,
  entriesSince,
  askCoach,
  getAiSettings,
} from "@/lib/storage"
import type { RetroArea, RetroVersion, CoachMsg } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { Markdown } from "@/components/Markdown"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/retro/$areaId")({ component: RetroAreaScreen })

// The coach must end the session with these exact blocks so the app can save
// the new doc version. Parsing failure keeps the session open — never lose a doc.
const FINALIZE_INSTRUCTION =
  "Please finalize the retrospective now. Respond with ONLY two blocks: " +
  "<summary>a short change summary — what changed, what was decided, new goals</summary> " +
  "followed by <doc>the complete updated state-of-affairs markdown document</doc>. " +
  "The doc must be the full document, not a diff."

function parseFinal(text: string): { summary: string; doc: string } | null {
  const summary = text.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim()
  const doc = text.match(/<doc>([\s\S]*?)<\/doc>/)?.[1]?.trim()
  return summary && doc ? { summary, doc } : null
}

function coachSystemPrompt(areaLabel: string): string {
  return (
    `You are the user's ${areaLabel} coach inside their personal life-OS. ` +
    `You are proficient and incredibly sharp at getting goals done and improving the user's ${areaLabel.toLowerCase()} posture. ` +
    `You are direct, concrete, and goal-driven — no fluff, no generic advice, no hedging. ` +
    `You are running a structured retrospective over the user's living "state of affairs" document for this area.\n\n` +
    `Work through it in order: (1) acknowledge what changed since last time based on the intake; ` +
    `(2) ask focused questions — at most two at a time — about anything unclear, stale, or missing from the doc; ` +
    `(3) challenge weak spots and propose concrete changes and NEW goals with numbers and dates where possible; ` +
    `(4) when the user is done (or has nothing more), summarize the proposed doc changes and new goals and ask them to confirm.\n\n` +
    `When asked to finalize, follow the <summary>/<doc> format exactly. ` +
    `Keep the doc's original structure and formatting; update values, check off or add checklist items, ` +
    `fold in new goals, and prune only what the user agreed is obsolete. ` +
    `If the intake contained nothing relevant, say so plainly — do not invent changes.`
  )
}

function RetroAreaScreen() {
  const { areaId } = Route.useParams()
  const [area, setArea] = useState<RetroArea | null>(null)
  const [version, setVersion] = useState<RetroVersion | null | undefined>(undefined)
  const [editText, setEditText] = useState("")
  const [mode, setMode] = useState<"view" | "edit" | "session">("view")

  // Session state — transcript is client-held; only the final doc persists.
  const [transcript, setTranscript] = useState<CoachMsg[]>([])
  const [chatDraft, setChatDraft] = useState("")
  const [preSessionContext, setPreSessionContext] = useState("")
  const [busy, setBusy] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([listRetroAreas(), latestRetro(areaId)])
      .then(([areas, v]) => {
        const a = areas.find((x) => x.id === areaId) ?? null
        setArea(a)
        setVersion(v)
        if (!v) setMode("edit") // no doc yet → seed-by-paste mode
      })
      .catch((err) => toast.error(`Couldn't load: ${err.message}`))
  }, [areaId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcript, busy])

  if (!area || version === undefined) return null

  const saveManual = () => {
    const doc = editText.trim()
    if (!doc) return
    saveRetroVersion(areaId, doc, null, null)
      .then(() => latestRetro(areaId))
      .then((v) => {
        setVersion(v)
        setMode("view")
        toast.success(version ? "Doc updated (manual version)" : "Doc seeded")
      })
      .catch((err) => toast.error(`Didn't save: ${err.message}`))
  }

  const startSession = async () => {
    if (!version) return
    setBusy(true)
    try {
      const settings = await getAiSettings()
      if (!settings) {
        toast.error("Set up your AI provider in Settings first")
        return
      }
      // Cutoff = the last COACH run, not the last doc version — a manual edit
      // in between must not swallow the reflections that preceded it.
      const cutoff = await latestCoachRunAt(areaId)
      const signal = await entriesSince(cutoff)
      const signalBlock = signal.length
        ? signal
            .map(
              (e) =>
                `- ${e.date}${e.wellness != null ? ` (wellness ${e.wellness.toFixed(1)}/5)` : ""}: ${e.reflection}`,
            )
            .join("\n")
        : "(no journal entries with reflections since the last retro)"
      const intake =
        `INTAKE for this ${area.label} retrospective.\n\n` +
        `## Current state-of-affairs doc (last updated ${new Date(version.createdAt).toLocaleDateString()})\n\n` +
        `${version.docMd}\n\n` +
        `## New signal since the last retro (daily reflections)\n\n${signalBlock}\n\n` +
        `## Context I'm adding right now\n\n${preSessionContext.trim() || "(nothing extra)"}\n\n` +
        `Start the retrospective.`
      const first: CoachMsg[] = [{ role: "user", content: intake }]
      setTranscript(first)
      setMode("session")
      const reply = await askCoach(coachSystemPrompt(area.label), first)
      setTranscript([...first, { role: "assistant", content: reply }])
    } catch (err) {
      toast.error((err as Error).message)
      setMode("view")
    } finally {
      setBusy(false)
    }
  }

  const sendChat = async () => {
    const text = chatDraft.trim()
    if (!text || busy) return
    const next: CoachMsg[] = [...transcript, { role: "user", content: text }]
    setTranscript(next)
    setChatDraft("")
    setBusy(true)
    try {
      const reply = await askCoach(coachSystemPrompt(area.label), next)
      setTranscript([...next, { role: "assistant", content: reply }])
    } catch (err) {
      toast.error((err as Error).message)
      setTranscript(transcript) // roll back the unsent turn
      setChatDraft(text)
    } finally {
      setBusy(false)
    }
  }

  const finishSession = async () => {
    if (busy) return
    setBusy(true)
    try {
      const settings = await getAiSettings()
      const next: CoachMsg[] = [...transcript, { role: "user", content: FINALIZE_INSTRUCTION }]
      const reply = await askCoach(coachSystemPrompt(area.label), next, 8192)
      const parsed = parseFinal(reply)
      if (!parsed) {
        // Keep the session alive — show the reply so the user can retry.
        setTranscript([...next, { role: "assistant", content: reply }])
        toast.error("Coach didn't return a final doc — ask again or keep going")
        return
      }
      await saveRetroVersion(
        areaId,
        parsed.doc,
        parsed.summary,
        settings ? `${settings.provider}:${settings.model}` : null,
      )
      const v = await latestRetro(areaId)
      setVersion(v)
      setTranscript([])
      setPreSessionContext("")
      setMode("view")
      toast.success("Retro complete — doc updated")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <Link
          to="/retro"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-semibold tracking-tight"
        >
          <ArrowLeft size={15} />
          Retrospectives
        </Link>
        <span className="text-muted-foreground text-xs">{area.label}</span>
      </div>

      {mode === "view" && version && (
        <>
          <div className="mt-3 flex items-center gap-2">
            <h1 className="text-[15px] font-medium">{area.label}</h1>
            <span className="text-muted-foreground ml-auto text-[11px]">
              v. {new Date(version.createdAt).toLocaleDateString()}
              {version.model ? ` · ${version.model}` : " · manual"}
            </span>
          </div>

          {version.aiSummary && (
            <div className="border-info/40 bg-info/10 mt-2 rounded-md border px-3 py-2 text-[12px]">
              <p className="text-info mb-0.5 font-medium">Last retro summary</p>
              <Markdown>{version.aiSummary}</Markdown>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={startSession} disabled={busy}>
              <Play /> {busy ? "Starting…" : "Run retrospective"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditText(version.docMd)
                setMode("edit")
              }}
            >
              <Pencil /> Edit doc
            </Button>
          </div>

          <textarea
            placeholder="Anything to add before the session? New numbers, events, context… (optional)"
            value={preSessionContext}
            onChange={(e) => setPreSessionContext(e.target.value)}
            rows={2}
            className="border-input bg-input/30 focus-visible:border-ring mt-3 w-full resize-none rounded-lg border p-2.5 text-[13px] outline-none"
          />

          <div className="border-border bg-input/20 mt-3 overflow-x-auto rounded-lg border p-3">
            <Markdown>{version.docMd}</Markdown>
          </div>
        </>
      )}

      {mode === "edit" && (
        <>
          <h1 className="mt-3 text-[15px] font-medium">
            {version ? `Edit ${area.label} doc` : `Seed ${area.label}`}
          </h1>
          {!version && (
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              Paste your existing state-of-affairs markdown — numbers,
              checklists, everything. This becomes version 1.
            </p>
          )}
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={18}
            placeholder={`# ${area.label} — state of affairs\n\n…`}
            className="border-input bg-input/30 focus-visible:border-ring mt-3 w-full resize-y rounded-lg border p-3 font-mono text-[12px] leading-relaxed outline-none"
          />
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" onClick={saveManual} disabled={!editText.trim()}>
              Save {version ? "as new version" : "doc"}
            </Button>
            {version && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode("view")}>
                Cancel
              </Button>
            )}
          </div>
        </>
      )}

      {mode === "session" && (
        <>
          <h1 className="mt-3 text-[15px] font-medium">{area.label} retrospective</h1>
          <div className="mt-3 flex flex-col gap-2.5">
            {/* Hide the bulky intake message; show coach + user turns after it. */}
            {transcript.slice(1).map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[92%] rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                  m.role === "assistant"
                    ? "border-border bg-input/20 self-start border"
                    : "bg-primary text-primary-foreground self-end whitespace-pre-wrap",
                )}
              >
                {m.role === "assistant" ? <Markdown>{m.content}</Markdown> : m.content}
              </div>
            ))}
            {busy && (
              <p className="text-muted-foreground animate-pulse self-start text-[12px]">
                coach is thinking…
              </p>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="bg-background sticky bottom-0 mt-3 flex flex-col gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-end gap-2">
              <textarea
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    sendChat()
                  }
                }}
                rows={2}
                placeholder="Reply to your coach…"
                className="border-input bg-input/30 focus-visible:border-ring w-full resize-none rounded-lg border p-2.5 text-[13px] outline-none"
              />
              <Button
                type="button"
                size="icon"
                aria-label="Send message"
                onClick={sendChat}
                disabled={busy || !chatDraft.trim()}
              >
                <Send />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={finishSession}
              disabled={busy || transcript.length < 2}
            >
              <Square /> Finish & update doc
            </Button>
          </div>
        </>
      )}
    </>
  )
}
