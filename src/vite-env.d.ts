/// <reference types="vite/client" />

// Typed `import.meta.env` — see .env.example.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  // Dev-only one-tap sign-in against the local Supabase stack (routes/login.tsx).
  readonly VITE_DEV_LOGIN_EMAIL?: string
  readonly VITE_DEV_LOGIN_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// The fatal error screen's hook, defined by the inline script in index.html.
// Optional: tests and anything else without that script don't have it.
interface Window {
  __vanyaFatal?: (
    error: unknown,
    extra?: { source?: string; componentStack?: string | undefined },
  ) => void
}
