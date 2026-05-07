"use client"
import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const AuthContext = createContext<any>(null)

function isInvalidRefreshToken(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("refresh token")
}

function clearCachedSupabaseSession() {
  if (typeof window === "undefined") return

  Object.keys(window.localStorage)
    .filter((key) => key === "supabase.auth.token" || (key.startsWith("sb-") && key.endsWith("-auth-token")))
    .forEach((key) => window.localStorage.removeItem(key))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        if (isInvalidRefreshToken(error)) {
          clearCachedSupabaseSession()
          await supabase.auth.signOut({ scope: "local" })
        } else {
          console.error("Failed to load Supabase session:", error)
        }

        setUser(null)
        setLoading(false)
        return
      }

      setUser(data.session?.user ?? null)
      setLoading(false)
    }

    loadSession().catch(async (error) => {
      if (isInvalidRefreshToken(error)) {
        clearCachedSupabaseSession()
        await supabase.auth.signOut({ scope: "local" })
      } else {
        console.error("Failed to initialize auth:", error)
      }

      if (mounted) {
        setUser(null)
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUp = (email: string, password: string) =>
    supabase.auth.signUp({ email, password })

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
