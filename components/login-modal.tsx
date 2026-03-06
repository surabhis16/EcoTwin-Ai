"use client"
import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function LoginModal({ onClose }: { onClose: () => void }) {
  const { signIn, signUp } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError("")
    const { error } = mode === "login"
      ? await signIn(email, password)
      : await signUp(email, password)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      onClose()
      router.push("/dashboard")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-background border border-border rounded-2xl p-8 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-bold mb-1">
          {mode === "login" ? "Welcome back" : "Create account"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "login" ? "Sign in to access the platform" : "Start exploring EcoTwin AI"}
        </p>

        <div className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="rounded-xl"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="rounded-xl"
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button onClick={handleSubmit} disabled={loading} className="w-full rounded-xl py-6">
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : mode === "login" ? "Sign In" : "Sign Up"
            }
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError("") }}
            className="text-primary hover:underline font-medium"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  )
}