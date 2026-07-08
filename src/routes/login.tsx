import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export const Route = createFileRoute("/login")({ component: Login })

function Login() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const sendLink = async () => {
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

  if (sent) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-medium">Check your inbox</p>
        <p className="text-sm text-muted-foreground">
          Tap the link we sent to {email} to finish signing in.
        </p>
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
          onKeyDown={(e) => e.key === "Enter" && sendLink()}
        />
        <Button className="w-full" onClick={sendLink} disabled={loading || !email}>
          {loading ? "Sending…" : "Send magic link"}
        </Button>
      </div>
    </div>
  )
}
