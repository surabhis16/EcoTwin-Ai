"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Globe } from "lucide-react"

export function Navigation() {
  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-background/60 backdrop-blur-md"
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg shadow-primary/20">
            <Globe className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-foreground to-foreground/70">
            UrbanCool AI
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          
          <Button variant="ghost" asChild className="hover:bg-primary/5"><Link href="#features">Features</Link></Button>
          <div className="w-px h-6 bg-border/50 mx-2" />

        </div>
      </div>
    </motion.nav>
  )
}