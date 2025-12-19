"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"

export function CTASection() {
  return (
    <section className="py-32 relative overflow-hidden">
      {/* Aurora Background Effect */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -inset-full opacity-30 animate-[spin_20s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#10b981_0%,#3b82f6_25%,#10b981_50%,#3b82f6_75%,#10b981_100%)] blur-[120px]" />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          className="max-w-4xl mx-auto text-center bg-background/40 backdrop-blur-2xl border border-white/10 p-12 md:p-20 rounded-[3rem] shadow-2xl"
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
            Ready to transform <br /><span className="text-primary">urban planning?</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-xl mx-auto">
            Join the ecosystem of policymakers and planners building the future of Bengaluru.
          </p>

          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <Input
              type="email"
              placeholder="name@government.in"
              className="h-14 rounded-full bg-background/80 border-white/10 px-6 focus:ring-primary/50"
            />
            <Button size="lg" className="h-14 px-8 rounded-full group">
              Get Started
              <Send className="ml-2 h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </Button>
          </form>
        </motion.div>
      </div>
    </section>
  )
}