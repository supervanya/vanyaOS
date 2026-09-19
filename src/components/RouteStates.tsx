import { useRouter, type ErrorComponentProps } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { errorMessage } from "@/lib/errors"

/**
 * Shown while a route's loader is still fetching (after the router's pending
 * delay). Routes with a distinct shape pass their own `pendingComponent`.
 */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-4/5" />
      </div>
    </div>
  )
}

/** A loader or render failed: say what happened and offer a retry. */
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-medium">Couldn't load this page</p>
      <p className="max-w-xs text-xs text-muted-foreground">{errorMessage(error)}</p>
      <Button variant="outline" size="sm" onClick={() => void router.invalidate()}>
        Try again
      </Button>
    </div>
  )
}
