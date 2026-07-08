import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export const Route = createFileRoute("/login")({ component: Login })

// Sign-in is a 6-digit email code, NOT a tap-the-link flow: the installed PWA
// and the browser have separate storage partitions on iOS, so a magic link
// opens in the browser and its session never reaches the PWA. A code typed
// into the app keeps the whole flow inside whichever context you're in.
// (The email still carries a link as a desktop convenience.)
function Login() {
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const { session } = useAuth()
  const navigate = useNavigate()

  // Already signed in (or just verified) → go to the reflection screen.
  useEffect(() => {
    if (session) navigate({ to: "/", replace: true })
  }, [session, navigate])

  const sendCode = async () => {
    if (!email || loading) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setSent(true)
  }

  const verifyCode = async () => {
    const token = code.trim()
    if (token.length < 6 || loading) return
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    // Success → onAuthStateChange sets the session and the effect above redirects.
  }

  if (sent) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center">
        <div className="w-full max-w-xs space-y-3 text-center">
          <p className="text-lg font-medium">Check your inbox</p>
          <p className="text-muted-foreground text-sm">
            Enter the 6-digit code we sent to {email}.
          </p>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="123456"
            className="text-center text-lg tracking-[0.4em] tabular-nums"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && verifyCode()}
            autoFocus
          />
          <Button
            className="w-full"
            onClick={verifyCode}
            disabled={loading || code.trim().length < 6}
          >
            {loading ? "Verifying…" : "Sign in"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setSent(false)
              setCode("")
            }}
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center">
      <div className="w-full max-w-xs space-y-3">
        <p className="text-center text-lg font-medium">VanyaOS</p>
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendCode()}
        />
        <Button className="w-full" onClick={sendCode} disabled={loading || !email}>
          {loading ? "Sending…" : "Email me a code"}
        </Button>
      </div>
    </div>
  )
}
