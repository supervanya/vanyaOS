import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { errorMessage } from "@/lib/errors"

export const Route = createFileRoute("/login")({ component: Login })

// Email + password, not a magic link: on iOS the installed PWA and the browser
// have separate storage, so tapping an emailed link signs in the browser, never
// the PWA. A real <form> with these autocomplete values lets the password
// manager fill and save the credentials in both.
function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const signIn = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) toast.error(error.message)
      // Success → the sign-in re-runs the router's auth check, which leaves /login.
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center">
      <form
        className="w-full max-w-xs space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void signIn()
        }}
      >
        <p className="text-center text-lg font-medium">VanyaOS</p>
        <Input
          type="email"
          name="email"
          inputMode="email"
          autoComplete="username"
          aria-label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          aria-label="Password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" className="w-full" disabled={loading || !email || !password}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  )
}
