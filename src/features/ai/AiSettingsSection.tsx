import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Bot, RefreshCw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { errorMessage } from "@/lib/errors"
import { oneOf } from "@/lib/parse"
import {
  AI_PROVIDERS,
  AI_PROVIDER_IDS,
  listProviderModels,
  saveAiSettings,
  type AiProvider,
  type AiSettings,
} from "./api"
import { aiSettingsQuery, storedKeyModelsQuery } from "./queries"

export function AiSettingsSection() {
  const { data: stored } = useSuspenseQuery(aiSettingsQuery)
  return <AiSettingsForm stored={stored} />
}

function AiSettingsForm({ stored }: { stored: AiSettings | null }) {
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState<AiProvider>(stored?.provider ?? "anthropic")
  const [model, setModel] = useState(stored?.model ?? AI_PROVIDERS.anthropic.models[0] ?? "")
  const [key, setKey] = useState("")
  // Which provider the STORED key belongs to — a stored Anthropic key must
  // never be silently re-labeled as an OpenAI credential by a provider switch.
  const [storedProvider, setStoredProvider] = useState<AiProvider | null>(
    stored?.hasKey ? stored.provider : null,
  )
  const [saving, setSaving] = useState(false)
  const storedKeyUsable = provider === storedProvider

  // Live catalog from the provider's own API. With a stored key it loads in
  // the background (quietly: on failure the static list below is the
  // fallback). A freshly pasted key can list models before saving, on request.
  const storedKeyModels = useQuery({
    ...storedKeyModelsQuery(storedProvider ?? "anthropic"),
    enabled: storedKeyUsable,
  })
  const [fetchedModels, setFetchedModels] = useState<string[] | null>(null)
  const [fetchingModels, setFetchingModels] = useState(false)
  const models = fetchedModels ?? (storedKeyUsable ? storedKeyModels.data : null) ?? null
  // A model the catalog doesn't list (e.g. retired) gives way to its first entry.
  const selectedModel = models && !models.includes(model) ? (models[0] ?? model) : model

  const fetchModels = (forProvider: AiProvider) => {
    setFetchingModels(true)
    const freshKey = key.trim()
    listProviderModels(freshKey ? forProvider : undefined, freshKey || undefined)
      .then(setFetchedModels)
      .catch((err: unknown) => {
        setFetchedModels(null)
        toast.error(`Couldn't fetch models: ${errorMessage(err)}`)
      })
      .finally(() => setFetchingModels(false))
  }

  const switchProvider = (next: AiProvider) => {
    setProvider(next)
    setModel(AI_PROVIDERS[next].models[0] ?? "")
    setFetchedModels(null)
    // A fresh key in the box can list the new provider's models pre-save; a
    // stored key can't (it may belong to the previous provider).
    if (key.trim()) fetchModels(next)
  }

  const save = async () => {
    if (!storedKeyUsable && !key.trim()) {
      toast.error(`Paste your ${AI_PROVIDERS[provider].label} API key first`)
      return
    }
    setSaving(true)
    try {
      await saveAiSettings(provider, selectedModel, key.trim() || undefined)
      setStoredProvider(provider)
      setModel(selectedModel)
      setKey("")
      toast.success("AI settings saved")
      void queryClient.invalidateQueries({ queryKey: ["ai"] })
    } catch (err) {
      toast.error(`Didn't save: ${errorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-6">
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Bot size={14} /> AI coach · bring your own provider
      </p>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <select
            value={provider}
            aria-label="AI provider"
            onChange={(e) => switchProvider(oneOf(AI_PROVIDER_IDS, e.target.value, "provider"))}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-[13px] dark:bg-input/30"
          >
            {AI_PROVIDER_IDS.map((p) => (
              <option key={p} value={p}>
                {AI_PROVIDERS[p].label}
              </option>
            ))}
          </select>
          {models ? (
            <select
              value={selectedModel}
              aria-label="Model"
              onChange={(e) => setModel(e.target.value)}
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-[13px] dark:bg-input/30"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              list="ai-models"
              placeholder="model"
              aria-label="Model"
              className="h-8 flex-1 text-[13px]"
            />
          )}
          <datalist id="ai-models">
            {AI_PROVIDERS[provider].models.map((m) => (
              // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- datalist options are labelled by their value
              <option key={m} value={m} />
            ))}
          </datalist>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Fetch models from provider"
            disabled={fetchingModels || (!key.trim() && !storedKeyUsable)}
            onClick={() => fetchModels(provider)}
            className="shrink-0"
          >
            <RefreshCw className={fetchingModels ? "animate-spin" : undefined} />
          </Button>
        </div>
        <Input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={
            storedKeyUsable
              ? "API key saved — paste to replace"
              : `Paste your ${AI_PROVIDERS[provider].label} API key`
          }
          aria-label="API key"
          autoComplete="off"
          className="h-8 text-[13px]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void save()}
          disabled={saving}
          className="self-start"
        >
          {saving ? "Saving…" : "Save AI settings"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Your key is stored in your own account row and only ever read by the coach function — the
          app has no AI keys of its own.
        </p>
      </div>
    </section>
  )
}
