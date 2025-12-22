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
import { updateUHIForSimulation } from "@/components/visualization-3d"

interface SimulationData {
  area: string
  intervention: string
  intensity: number

  temperatureReduction?: number
  co2Offset?: number
  riskReduction?: string

  lstBefore?: number
  lstAfter?: number
  ndviBefore?: number
  ndviAfter?: number

  coordinates?: {
    lon: number
    lat: number
  }
}


const Visualization3D = dynamic(
  () => import("@/components/visualization-3d").then(m => m.Visualization3D),
  { ssr: false }
)

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<"baseline" | "simulated">("baseline")
  const [comparisonMode, setComparisonMode] = useState(false)
  const [simulationActive, setSimulationActive] = useState(false)
  const [simulationData, setSimulationData] = useState<SimulationData | null>(null)
  const [selectedZone, setSelectedZone] = useState<string>("")
  const [materialApplied, setMaterialApplied] = useState(false)
  const [selectedWardData, setSelectedWardData] = useState<any>(null)

  const handleSimulate = (data: any) => {
    setSimulationData(data)
    setSimulationActive(true)
    setViewMode("simulated")
    setSelectedZone(data.area)

    // Update 3D visualization
    if (data.coordinates) {
      updateUHIForSimulation(data)
    }

    console.log("Full Simulation Result:", data)
  }

  const handleWardSelection = async (wardData: any) => {
    console.log("Ward selected from map:", wardData)
    setSelectedWardData(wardData)

    // Auto-simulate immediately 
    await handleSimulateWard(wardData)
  }

  const handleSimulateWard = async (wardData: any) => {
    try {
      // Call UHI API directly
      const response = await fetch('http://localhost:8000/api/uhi/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ndvi: wardData.ndvi,
          lon: wardData.lon,
          lat: wardData.lat,
          green_cover_increase: 0.2 // 20% increase
        })
      })

      if (!response.ok) throw new Error('API call failed')

      const prediction = await response.json()

      const simulationResult: SimulationData = {
        area: wardData.name,
        intervention: 'green',
        intensity: 100,
        temperatureReduction: prediction.cooling_effect,
        lstBefore: prediction.lst_before,
        lstAfter: prediction.lst_after,
        ndviBefore: prediction.ndvi_before,
        ndviAfter: prediction.ndvi_after,
        riskReduction: prediction.risk_reduction,
        co2Offset: Math.round(prediction.cooling_effect * 150),
        coordinates: { lon: wardData.lon, lat: wardData.lat }
      }


      // Update simulation state
      setSimulationData(simulationResult)
      setSimulationActive(true)
      setViewMode("simulated")

      // Update 3D visualization
      updateUHIForSimulation(simulationResult)

      //console.log("Ward Simulation Result:", simulationResult)

    } catch (err) {
      console.error("Ward simulation failed:", err)
      alert("Simulation failed. Is the backend running?")
    }
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

        {/* Ward Selection Indicator */}
        {selectedWardData && (
          <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-emerald-500">Selected Ward: {selectedWardData.name}</p>
                <p className="text-sm text-muted-foreground">
                  LST: {selectedWardData.lst.toFixed(2)}°C | NDVI: {selectedWardData.ndvi.toFixed(3)}
                </p>
              </div>
              <Button
                onClick={() => handleSimulateWard(selectedWardData)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Simulate This Ward
              </Button>
            </div>
          </div>
        )}

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
          <Visualization3D onWardSelect={handleWardSelection} />
        </div>
      </div>
    </div>
  )
}