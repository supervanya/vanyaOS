import { FunctionsHttpError } from "@supabase/supabase-js"
import { currentUserId } from "@/lib/auth"
import { errorMessage } from "@/lib/errors"
import { isRecord, oneOf } from "@/lib/parse"
import { supabase } from "@/lib/supabaseClient"

// Each account brings its own provider + key; the app holds no AI secrets.
// The key is write-mostly from the client: reads return whether one exists,
// not the key itself (the Edge Function is the only reader of the value).

export const AI_PROVIDER_IDS = ["anthropic", "openai", "google"] as const
export type AiProvider = (typeof AI_PROVIDER_IDS)[number]
export type AiSettings = { provider: AiProvider; model: string; hasKey: boolean }

// Static lists are a FALLBACK only — the real catalog is fetched live from the
// provider via the Edge Function (list-models action), so it never goes stale.
export const AI_PROVIDERS: Record<AiProvider, { label: string; models: string[] }> = {
  anthropic: {
    label: "Anthropic",
    models: ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5"],
  },
  openai: { label: "OpenAI", models: ["gpt-5.2", "gpt-5.2-mini"] },
  google: { label: "Google", models: ["gemini-3-pro", "gemini-3-flash"] },
}

// Live model catalog from the provider's own API, via the Edge Function
// (server-side: OpenAI blocks browser CORS). Pass provider+apiKey to list from
// a freshly pasted key BEFORE saving; omit both to use the stored settings.
export async function listProviderModels(
  provider?: AiProvider,
  apiKey?: string,
): Promise<string[]> {
  const data = await invokeCoachFunction({ action: "list-models", provider, apiKey })
  const models = data.models
  if (!Array.isArray(models) || !models.every((m) => typeof m === "string")) {
    throw new Error("ai-coach returned no model list")
  }
  return models
}

// Calls the ai-coach Edge Function and returns its JSON body, turning every
// failure — HTTP error, `{ error }` payload, unexpected shape — into an Error
// carrying the function's own message.
async function invokeCoachFunction(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await supabase.functions.invoke<unknown>("ai-coach", { body })
  const error: unknown = response.error
  const data: unknown = response.data
  if (error) {
    // supabase-js wraps non-2xx responses; surface the function's own message.
    let detail = errorMessage(error)
    const context: unknown = error instanceof FunctionsHttpError ? error.context : null
    if (context instanceof Response) {
      const payload: unknown = await context.json().catch(() => null)
      if (isRecord(payload) && typeof payload.error === "string") detail = payload.error
    }
    throw new Error(detail)
  }
  if (!isRecord(data)) throw new Error("ai-coach returned an unexpected response")
  if (typeof data.error === "string") throw new Error(data.error)
  return data
}

export async function getAiSettings(): Promise<AiSettings | null> {
  // Deliberately NOT selecting api_key — the key value must never reach the
  // browser (it would sit in the network response and client memory). The
  // column is NOT NULL, so a row existing already means a key is stored.
  const { data, error } = await supabase.from("ai_settings").select("provider, model").maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    provider: oneOf(AI_PROVIDER_IDS, data.provider, "ai_settings.provider"),
    model: data.model,
    hasKey: true,
  }
}

export async function saveAiSettings(
  provider: AiProvider,
  model: string,
  apiKey?: string, // omit to keep the stored key
): Promise<void> {
  const userId = await currentUserId()
  if (apiKey) {
    const { error } = await supabase.from("ai_settings").upsert({
      user_id: userId,
      provider,
      model,
      api_key: apiKey,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from("ai_settings")
      .update({ provider, model, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
    if (error) throw error
  }
}

// Provider-agnostic coach call: the Edge Function reads the caller's own
// ai_settings row and dispatches. Multi-turn: pass the running transcript.
export type CoachMsg = { role: "user" | "assistant"; content: string }

export async function askCoach(
  system: string,
  messages: CoachMsg[],
  maxTokens = 4096,
): Promise<string> {
  const data = await invokeCoachFunction({ system, messages, maxTokens })
  if (typeof data.text !== "string") throw new Error("ai-coach returned no text")
  return data.text
}
