"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Layers, MapPin, TrendingDown, TrendingUp, Leaf } from "lucide-react"
import { useState } from "react"

const materials = [
  {
    name: "Cool Roof Coating",
    score: 95,
    eco: "A+",
    cost: "$$",
    impact: "Reduces surface temp by 15°C",
    predictedImpact: {
      tempChange: -15,
      co2Reduction: 180,
      sustainabilityChange: +12,
    },
  },
  {
    name: "Permeable Pavement",
    score: 88,
    eco: "A",
    cost: "$$$",
    impact: "Improves water drainage 40%",
    predictedImpact: {
      tempChange: -8,
      co2Reduction: 95,
      sustainabilityChange: +8,
    },
  },
  {
    name: "Vertical Gardens",
    score: 92,
    eco: "A+",
    cost: "$$",
    impact: "Reduces CO2 by 25kg/m²/year",
    predictedImpact: {
      tempChange: -12,
      co2Reduction: 250,
      sustainabilityChange: +15,
    },
  },
]

interface MaterialRecommenderProps {
  selectedZone?: string
  onMaterialApplied?: (material: any) => void
}

export function MaterialRecommender({ selectedZone, onMaterialApplied }: MaterialRecommenderProps) {
  const [appliedMaterial, setAppliedMaterial] = useState<(typeof materials)[0] | null>(null)
  const [showImpact, setShowImpact] = useState(false)

  const handleApplyMaterial = (material: (typeof materials)[0]) => {
    setAppliedMaterial(material)
    setShowImpact(true)

    // Notify parent component that material was applied
    if (onMaterialApplied) {
      onMaterialApplied(material)
    }

    // Hide impact after 5 seconds
    setTimeout(() => setShowImpact(false), 5000)
  }

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold mb-1">City-Impact Material Simulator</h3>
          <p className="text-sm text-muted-foreground">
            {selectedZone ? `Simulating for: ${selectedZone}` : "Select a zone to apply materials"}
          </p>
        </div>
        <Layers className="h-6 w-6 text-primary" />
      </div>

      {showImpact && appliedMaterial && (
        <div className="mb-4 p-4 rounded-lg bg-primary/10 border-2 border-primary/50 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <p className="text-sm font-semibold text-primary">Digital Twin Updated</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Applied <span className="font-semibold text-foreground">{appliedMaterial.name}</span> to{" "}
            {selectedZone || "selected zone"}
          </p>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded bg-background/50">
              <div className="flex items-center gap-1 mb-1">
                <TrendingDown className="h-3 w-3 text-blue-500" />
                <p className="text-xs text-muted-foreground">Temp</p>
              </div>
              <p className="text-sm font-bold text-blue-500">{appliedMaterial.predictedImpact.tempChange}°C</p>
            </div>

            <div className="p-2 rounded bg-background/50">
              <div className="flex items-center gap-1 mb-1">
                <Leaf className="h-3 w-3 text-emerald-500" />
                <p className="text-xs text-muted-foreground">CO₂</p>
              </div>
              <p className="text-sm font-bold text-emerald-500">-{appliedMaterial.predictedImpact.co2Reduction}kg/yr</p>
            </div>

            <div className="p-2 rounded bg-background/50">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3 text-primary" />
                <p className="text-xs text-muted-foreground">Score</p>
              </div>
              <p className="text-sm font-bold text-primary">+{appliedMaterial.predictedImpact.sustainabilityChange}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {materials.map((material, index) => (
          <div
            key={index}
            className="p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/50 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-lg mb-1">{material.name}</h4>
                <p className="text-xs text-muted-foreground">{material.impact}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 rounded bg-primary/20 text-primary text-xs font-bold">{material.eco}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Score: <span className="text-foreground font-semibold">{material.score}/100</span>
                </span>
                <span className="text-muted-foreground">
                  Cost: <span className="text-foreground font-semibold">{material.cost}</span>
                </span>
              </div>
              <Button
                size="sm"
                variant="default"
                disabled={!selectedZone}
                onClick={() => handleApplyMaterial(material)}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Apply to Selected Zone
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
