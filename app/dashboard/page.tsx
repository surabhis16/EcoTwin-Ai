"use client"

import { DashboardNav } from "@/components/dashboard-nav"
import { InteractiveMap } from "@/components/interactive-map"
import { SentimentAnalysis } from "@/components/sentiment-analysis"
import { MaterialRecommender } from "@/components/material-recommender"
import { PolicySimulationEngine } from "@/components/policy-simulation-engine"
import { PredictedOutcomes } from "@/components/predicted-outcomes"
import { Button } from "@/components/ui/button"
import { SplitSquareHorizontal } from "lucide-react"
import { useState } from "react"

import dynamic from "next/dynamic"

const Visualization3D = dynamic(
  () => import("@/components/visualization-3d").then(m => m.Visualization3D),
  { ssr: false }
)

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<"baseline" | "simulated">("baseline")
  const [comparisonMode, setComparisonMode] = useState(false)
  const [simulationActive, setSimulationActive] = useState(false)
  const [simulationData, setSimulationData] = useState<{
    area: string
    intervention: string
    intensity: number
  } | null>(null)
  const [selectedZone, setSelectedZone] = useState<string>("")
  const [materialApplied, setMaterialApplied] = useState(false)

  const handleSimulate = (data: { area: string; intervention: string; intensity: number }) => {
    setSimulationData(data)
    setSimulationActive(true)
    setViewMode("simulated")
    setSelectedZone(data.area)
  }

  const handleMaterialApplied = (material: any) => {
    setMaterialApplied(true)
    setSimulationActive(true)
    setViewMode("simulated")

    // Reset after showing impact
    setTimeout(() => setMaterialApplied(false), 5000)
  }

  const toggleComparison = () => {
    if (!simulationActive) return
    setComparisonMode(!comparisonMode)
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-balance mb-2">Policy Analysis & Simulation Dashboard</h1>
          <p className="text-muted-foreground text-base">
            Evidence-based urban intervention modeling for Bengaluru Metropolitan Region
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between bg-card/50 backdrop-blur-sm rounded-lg p-4 border">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Analysis Mode</p>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "baseline" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("baseline")}
                >
                  Current State
                </Button>
                <Button
                  variant={viewMode === "simulated" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("simulated")}
                  disabled={!simulationActive}
                >
                  Projected State
                </Button>
              </div>
            </div>
            {viewMode === "simulated" && simulationActive && (
              <div className="text-sm">
                <p className="text-muted-foreground">Model projection timeframe</p>
                <p className="text-primary font-semibold">5-year impact assessment</p>
              </div>
            )}
          </div>

          <Button
            onClick={toggleComparison}
            disabled={!simulationActive}
            variant={comparisonMode ? "default" : "outline"}
            className="gap-2"
          >
            <SplitSquareHorizontal className="h-4 w-4" />
            Comparative Analysis View
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <InteractiveMap
            viewMode={viewMode}
            simulationActive={simulationActive}
            simulationData={simulationData}
            comparisonMode={comparisonMode}
          />
          <PredictedOutcomes simulationActive={simulationActive} simulationData={simulationData} />
          <PolicySimulationEngine onSimulate={handleSimulate} />
          <SentimentAnalysis />
          <MaterialRecommender selectedZone={selectedZone} onMaterialApplied={handleMaterialApplied} />
          <Visualization3D />
        </div>
      </div>
    </div>
  )
}
