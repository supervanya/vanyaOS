import * as Sentry from "@sentry/react"
import type { AnyRouter } from "@tanstack/react-router"

/**
 * Error, tracing and log reporting to Sentry (project supervanya/vanyaos-frontend).
 * Off when `VITE_SENTRY_DSN` is unset, so tests and DSN-less dev builds send nothing.
 */
export function initSentry(router: AnyRouter) {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // The deploy sets this to the commit SHA, so issues point at the build that broke.
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      // Pageload/navigation transactions named after TanStack Router routes.
      Sentry.tanstackRouterBrowserTracingIntegration(router),
      // Logs are on by default in SDK v11; this also sends console warnings and errors.
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
    ],
    // Every trace locally, a tenth of them in production.
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
  })
}

/**
 * A `createRoot` error hook (`onUncaughtError`, `onCaughtError`, …) that sends
 * the error to Sentry with its component stack, then logs it under `label`.
 */
export function reportReactError(label: string) {
  return (error: unknown, errorInfo: { componentStack?: string | undefined }) => {
    const componentStack = errorInfo.componentStack ?? null
    Sentry.captureReactException(error, { componentStack })
    console.error(label, error, componentStack)
  }
}
