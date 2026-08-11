// Provider-agnostic AI proxy — the only server-side code in VanyaOS.
// The app holds ZERO AI secrets: each caller's provider/model/API key lives in
// their own RLS-protected `ai_settings` row, read here with the caller's own
// JWT (so RLS applies; there is no service-role access in this function).
//
// Actions:
//   { action?: "chat", system?, messages: [{role, content}], maxTokens? } -> { text }
//   { action: "list-models", provider?, apiKey? }                         -> { models: string[] }
//     (provider/apiKey override supports listing BEFORE settings are saved;
//      otherwise the stored settings are used)
//
// Chat goes through the AI SDK (one generateText call instead of hand-rolled
// per-provider adapters). Model listing is hand-rolled because the SDK doesn't
// expose it — three small GETs.
//
// SECURITY: never log request bodies, settings rows, or provider payloads —
// they contain the user's API key and intimate journal content.

import { createClient } from "npm:@supabase/supabase-js@2";
import { generateText } from "npm:ai@5";
import { createAnthropic } from "npm:@ai-sdk/anthropic@2";
import { createOpenAI } from "npm:@ai-sdk/openai@2";
import { createGoogleGenerativeAI } from "npm:@ai-sdk/google@2";

type Msg = { role: "user" | "assistant"; content: string };
type Body = {
  action?: "chat" | "list-models";
  system?: string;
  messages?: Msg[];
  maxTokens?: number;
  provider?: string;
  apiKey?: string;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// One factory per provider; the AI SDK normalizes everything after this line.
const sdkModel = (provider: string, model: string, apiKey: string) => {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
};

// Model catalogs, fetched live from each provider so the app never ships a
// stale hardcoded list. Filtered to chat-capable text models, newest-ish first.
async function listModels(provider: string, apiKey: string): Promise<string[]> {
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return (data.data ?? []).map((m: { id: string }) => m.id);
  }
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return (data.data ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) => /^(gpt|o\d)/.test(id))
      .filter((id: string) => !/(audio|realtime|image|tts|transcribe|embed|moderation|search)/.test(id))
      .sort()
      .reverse();
  }
  if (provider === "google") {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
      headers: { "x-goog-api-key": apiKey },
    });
    if (!res.ok) throw new Error(`Google ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return (data.models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((m: { name: string }) => m.name.replace(/^models\//, ""))
      .filter((id: string) => /gemini/.test(id));
  }
  throw new Error(`Unknown provider: ${provider}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Not authenticated" }, 401);

  // Client scoped to the CALLER: their JWT rides along, so the ai_settings
  // read below goes through RLS and can only ever see their own row.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request: JSON body expected" }, 400);
  }

  // A DB/RLS failure here is an OPERATIONAL error (5xx), not "user has no
  // settings" — conflating them hides outages as configuration problems.
  const stored = async () => {
    const { data, error } = await supabase
      .from("ai_settings")
      .select("provider, model, api_key")
      .maybeSingle();
    if (error) throw new Error("Settings lookup failed");
    return data;
  };

  if (body.action === "list-models") {
    // Ephemeral override lets the UI list models from a freshly pasted key
    // BEFORE anything is saved; the key is used for this one call only.
    let provider = body.provider;
    let apiKey = body.apiKey;
    try {
      if (!provider || !apiKey) {
        const s = await stored();
        if (!s) return json({ error: "No AI provider configured" }, 400);
        provider = provider ?? s.provider;
        apiKey = apiKey ?? s.api_key;
      }
      return json({ models: await listModels(provider!, apiKey!) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Model listing failed";
      return json({ error: msg }, msg === "Settings lookup failed" ? 500 : 502);
    }
  }

  // Default action: chat.
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: "Bad request: expected { messages: [...] }" }, 400);
  }
  let s;
  try {
    s = await stored();
  } catch {
    return json({ error: "Settings lookup failed" }, 500);
  }
  if (!s) return json({ error: "No AI provider configured — set one up in Settings → AI." }, 400);

  try {
    const { text } = await generateText({
      model: sdkModel(s.provider, s.model, s.api_key),
      system: body.system,
      messages: body.messages,
      maxOutputTokens: body.maxTokens ?? 4096,
    });
    return json({ text });
  } catch (err) {
    // Provider errors (bad key, bad model, rate limit) surface to the client;
    // they never contain the key itself.
    return json({ error: err instanceof Error ? err.message : "Provider call failed" }, 502);
  }
});
