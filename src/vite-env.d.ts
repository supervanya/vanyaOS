/// <reference types="vite/client" />

// Typed `import.meta.env` — see .env.example.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  // Dev-only one-tap sign-in against the local Supabase stack (routes/login.tsx).
  readonly VITE_DEV_LOGIN_EMAIL?: string
  readonly VITE_DEV_LOGIN_PASSWORD?: string
  // Sentry error reporting (src/lib/sentry.ts); unset disables it.
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_RELEASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
