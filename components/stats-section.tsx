"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { useCountUp } from "@/hooks/use-up-count"
export function StatsSection() {
  const stat1 = useCountUp(79)
  const stat2 = useCountUp(13)

  return (
    <section className="py-24 border-y border-white/5 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { count: stat1.count, label: "Decline in green cover since 2000", suffix: "%", color: "text-emerald-500", ref: stat1.ref },
            { count: stat2.count, label: "Population surge since 2001", suffix: "M+", color: "text-orange-500", ref: stat2.ref },
            { count: "Live", label: "Urban insights and analytics", suffix: "", color: "text-blue-500", ref: null }
          ].map((item, i) => (
            <motion.div key={i} whileHover={{ scale: 1.02 }} className="h-full">
              <Card ref={item.ref as any} className="p-10 bg-background/50 border-white/5 flex flex-col items-center text-center h-full justify-center">
                <div className={`text-6xl font-black mb-4 tracking-tighter ${item.color}`}>
                  {item.count}{item.suffix}
                </div>
                <p className="text-muted-foreground font-medium max-w-50">{item.label}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}