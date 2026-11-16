/// <reference types="vite/client" />

// Typed `import.meta.env` — see .env.example.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  // Sentry error reporting (src/lib/sentry.ts); unset disables it.
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_RELEASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
