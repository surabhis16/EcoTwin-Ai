"use client"

import { useEffect, useState, useRef } from "react"
import { motion, useScroll, useTransform, useSpring } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play, Globe2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { LoginModal } from "@/components/login-modal"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"


export function HeroSection() {
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Subtle parallax effect based on scroll
  const { scrollY } = useScroll()
  const y1 = useTransform(scrollY, [0, 500], [0, 200])
  const y2 = useTransform(scrollY, [0, 500], [0, -150])

  if (!mounted) return null

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background pt-20"
    >
      {/* Dynamic Background Layer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98115_1px,transparent_1px),linear-gradient(to_bottom,#10b98115_1px,transparent_1px)] bg-size-[4.5rem_4.5rem] mask-[radial-gradient(ellipse_60%_50%_at_50%_50%,black_70%,transparent_100%)]" />

        {/* Animated Blobs with Parallax */}
        <motion.div
          style={{ y: y1 }}
          className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-primary/10 blur-[120px] animate-pulse"
        />
        <motion.div
          style={{ y: y2 }}
          className="absolute bottom-1/4 -right-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px] animate-pulse"
        />
      </div>

      <div className="container relative z-10 mx-auto px-4 text-center">
        {/* Top Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium mb-8 backdrop-blur-sm"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Live Digital Twin: Bengaluru
        </motion.div>

        {/* Main Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-6 text-balance"
        >
          EcoTwin AI: The Future of{" "}
          <span className="relative inline-block">
            <span className="bg-clip-text text-transparent bg-linear-to-r from-emerald-400 to-cyan-500">
              Urban Sustainability
            </span>
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1, delay: 1 }}
              className="absolute -bottom-2 left-0 h-1 bg-linear-to-r from-emerald-400/50 to-transparent rounded-full"
            />
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
        >
          Visualizing the pulse of the city. Leveraging satellite data, AI models, and 3D city visualization to simulate sustainable urban planning decisions.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Button
            size="lg"
            className="group text-lg px-8 py-7 rounded-full transition-all hover:scale-105"
            onClick={() => user ? router.push("/dashboard") : setShowLogin(true)}
>
            {user ? "Go to Dashboard" : "Explore Platform"}
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>

          <Button size="lg" variant="outline" className="group text-lg px-8 py-7 rounded-full border-primary/20 hover:bg-primary/5 backdrop-blur-sm">
            <Play className="mr-2 h-5 w-5 fill-current" />
            Watch Demo
          </Button>
        </motion.div>

        {user && (
          <Button
            size="lg" variant="ghost"
            className="text-sm text-muted-foreground"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        )}

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-20 pt-10 border-t border-border/40 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto opacity-60"
        >
          {[
            { label: "Real-time Data", icon: Globe2 },
            { label: "AI Prediction", icon: "✨" },
            { label: "Cloud Ready", icon: "☁️" },
            { label: "Open Source", icon: "📂" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-center gap-2 grayscale hover:grayscale-0 transition-all">
              {typeof item.icon === 'string' ? <span>{item.icon}</span> : <item.icon className="h-4 w-4" />}
              <span className="text-xs font-semibold uppercase tracking-widest">{item.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </section>
  )
}