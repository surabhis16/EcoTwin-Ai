"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Thermometer, Brain, Layers, Globe } from "lucide-react"

const features = [
  { icon: Thermometer, title: "Urban Heat Mitigation", description: "Simulate cooling interventions using AI and high-res satellite data.", color: "from-orange-500/20 to-red-500/20", iconColor: "text-orange-500" },
  { icon: Brain, title: "Sentiment Analysis", description: "Capture the city's emotional pulse through geo-tagged community feedback.", color: "from-blue-500/20 to-purple-500/20", iconColor: "text-blue-500" },
  { icon: Layers, title: "Material Recommender", description: "Smart material selection optimized for Bengaluru's specific climate index.", color: "from-emerald-500/20 to-teal-500/20", iconColor: "text-emerald-500" },
  {
    icon: Globe, title: "3D Visualization", description: "Immersive 3D city twin integrating simulated environmental and sustainability layers."
    , color: "from-cyan-500/20 to-blue-500/20", iconColor: "text-cyan-500"
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Platform Features
          </motion.h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Harnessing generative AI to solve complex urban challenges.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <Card className="p-8 h-full bg-card/40 backdrop-blur-md border-white/5 hover:border-primary/30 transition-colors group relative overflow-hidden">
                <div className={`absolute inset-0 bg-linear-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative z-10 flex gap-6">
                  <div className={`p-4 rounded-2xl bg-muted/50 ${feature.iconColor} group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}