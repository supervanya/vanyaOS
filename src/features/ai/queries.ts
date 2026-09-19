import { queryOptions } from "@tanstack/react-query"
import { getAiSettings, listProviderModels, type AiProvider } from "./api"

/** Provider + model, and whether a key is stored — never the key itself. */
export const aiSettingsQuery = queryOptions({
  queryKey: ["ai", "settings"],
  queryFn: getAiSettings,
})

/** The live model catalog for the stored key (read server-side by the Edge Function). */
export const storedKeyModelsQuery = (provider: AiProvider) =>
  queryOptions({
    queryKey: ["ai", "models", provider],
    queryFn: () => listProviderModels(),
    retry: false,
  })
