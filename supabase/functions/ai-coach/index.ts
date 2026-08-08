// Provider-agnostic AI chat proxy — the only server-side code in VanyaOS.
// The app holds ZERO AI secrets: each caller's provider/model/API key lives in
// their own RLS-protected `ai_settings` row, read here with the caller's own
// JWT (so RLS applies; there is no service-role access in this function).
//
// Input:  { system?: string, messages: [{ role: 'user'|'assistant', content: string }], maxTokens?: number }
// Output: { text: string }  |  { error: string }
//
// SECURITY: never log request bodies, settings rows, or provider payloads —
// they contain the user's API key and intimate journal content.

import { createClient } from "npm:@supabase/supabase-js@2";

type Msg = { role: "user" | "assistant"; content: string };
type Payload = { system?: string; messages: Msg[]; maxTokens?: number };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function callAnthropic(model: string, key: string, p: Payload): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: p.maxTokens ?? 4096,
      system: p.system,
      messages: p.messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
}

async function callOpenAI(model: string, key: string, p: Payload): Promise<string> {
  const messages = [
    ...(p.system ? [{ role: "system", content: p.system }] : []),
    ...p.messages,
  ];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, max_completion_tokens: p.maxTokens ?? 4096, messages }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGoogle(model: string, key: string, p: Payload): Promise<string> {
  const contents = p.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: p.system ? { parts: [{ text: p.system }] } : undefined,
        generationConfig: { maxOutputTokens: p.maxTokens ?? 4096 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Google ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts ?? [])
    .map((part: { text?: string }) => part.text ?? "")
    .join("");
}

const ADAPTERS: Record<string, (model: string, key: string, p: Payload) => Promise<string>> = {
  anthropic: callAnthropic,
  openai: callOpenAI,
  google: callGoogle,
};

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

  const { data: settings } = await supabase
    .from("ai_settings")
    .select("provider, model, api_key")
    .maybeSingle();
  if (!settings) {
    return json({ error: "No AI provider configured — set one up in Settings → AI." }, 400);
  }

  let payload: Payload;
  try {
    payload = await req.json();
    if (!Array.isArray(payload.messages) || payload.messages.length === 0) throw new Error();
  } catch {
    return json({ error: "Bad request: expected { messages: [...] }" }, 400);
  }

  const adapter = ADAPTERS[settings.provider];
  if (!adapter) return json({ error: `Unknown provider: ${settings.provider}` }, 400);

  try {
    const text = await adapter(settings.model, settings.api_key, payload);
    return json({ text });
  } catch (err) {
    // Provider errors (bad key, bad model, rate limit) surface to the client
    // verbatim-ish; they never contain the key itself.
    return json({ error: err instanceof Error ? err.message : "Provider call failed" }, 502);
  }
});
