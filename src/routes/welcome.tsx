import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { NameForm } from "@/features/identity/NameForm"

export const Route = createFileRoute("/welcome")({ component: Welcome })

// A new account's first stop: the root route sends it here until it has a
// name. The name titles the app, including when it's installed, so it comes
// before anything else.
function Welcome() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center">
      <div className="w-full max-w-xs space-y-3">
        <p className="text-center text-lg font-medium">What should we call you?</p>
        <NameForm onSaved={() => void navigate({ to: "/", replace: true })} />
      </div>
    </div>
  )
}
