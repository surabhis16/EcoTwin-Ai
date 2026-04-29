"use client"

import { Card } from "@/components/ui/card"
import { Activity, Zap, IndianRupee, Car } from "lucide-react"

interface FeasibilityProps {
  metrics: {
    energySavingsPercent: string
    carEquivalent: number
    estimatedCostCr: string
  }
}

export function FeasibilityAnalysis({ metrics }: FeasibilityProps) {
  return (
    <Card className="lg:col-span-1 p-8 border-blue-500/20 bg-linear-to-br from-blue-950/20 to-background shadow-lg h-full">
      <div className="mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-400" />
          Feasibility & Strategic Benefits
        </h3>
        <p className="text-sm text-muted-foreground">
          Economic and social implications
        </p>
      </div>

      <div className="flex flex-col gap-6 h-full justify-around">
        {/* Energy Savings */}
        <div className="flex flex-col gap-2 p-5 rounded-xl bg-card/50 border">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-8 w-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-yellow-500" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">Energy Efficiency</span>
          </div>
          <p className="text-3xl font-black text-foreground">
            {metrics.energySavingsPercent}%
          </p>
          <p className="text-xs text-muted-foreground">
            Estimated reduction in cooling energy demand from lower urban temperatures.
          </p>
        </div>

        {/* Cost Estimate */}
        <div className="flex flex-col gap-2 p-5 rounded-xl bg-card/50 border">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
              <IndianRupee className="h-4 w-4 text-green-500" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">Implementation Cost</span>
          </div>
          <p className="text-3xl font-black text-foreground">
            ₹{metrics.estimatedCostCr} Cr
          </p>
          <p className="text-xs text-muted-foreground">
            Estimated capital cost for recommended cooling and greening interventions.
          </p>
        </div>

        {/* Social Impact */}
        <div className="flex flex-col gap-2 p-5 rounded-xl bg-card/50 border">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Car className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">Emission Benefit</span>
          </div>
          <p className="text-3xl font-black text-foreground">
            -{metrics.carEquivalent}
          </p>
          <p className="text-xs text-muted-foreground">
            Equivalent reduction in annual vehicle emissions from the intervention.
          </p>
        </div>
      </div>
    </Card>
  )
}