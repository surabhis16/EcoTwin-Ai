"use client"

import { DashboardNav } from "@/components/dashboard-nav"
import { InteractiveMap } from "@/components/interactive-map"
import { SentimentAnalysis } from "@/components/sentiment-analysis"
import MaterialRecommender from "@/components/material-recommender"
import PolicySimulationEngine from "@/components/policy-simulation-engine"
import { PredictedOutcomes } from "@/components/predicted-outcomes"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  SplitSquareHorizontal,
  TrendingDown,
  Thermometer,
  MapPin,
  ArrowRight
} from "lucide-react"
import { useState } from "react"
import dynamic from "next/dynamic"
import { updateUHIForSimulation } from "@/components/visualization-3d"

interface SimulationData {
  wardId: number
  wardName: string
  area: string
  intervention: string
  intensity: number

  // temperature metrics
  temperatureReduction: number
  lstBefore: number
  lstAfter: number
  baseCooling?: number // cooling from vegetation
  materialCooling?: number // cooling from materials

  // NDVI metrics
  ndviBefore: number
  ndviAfter: number

  // Risk assessment
  risk_before: string
  risk_after: string

  // Impact metrics
  co2Offset: number // Annual (Trees)
  materialCO2?: number // One-time (Materials)

  // Material Info
  selectedMaterial?: any

  // Location
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
  const [selectedSentimentWard, setSelectedSentimentWard] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSentimentZoneClick = async (wardNumber: number) => {
    setError(null)

    try {
      const baselineRes = await fetch(`http://localhost:8000/api/uhi/ward-baseline/${wardNumber}`)
      if (!baselineRes.ok) throw new Error(`Failed to fetch ward baseline`)
      const baselineData = await baselineRes.json()

      const wardData = {
        ...baselineData,
        wardId: baselineData.ward_id,
        ward_number: baselineData.ward_id,
        name: baselineData.ward_name,
        lst_before: baselineData.lst_before || baselineData.baseline_lst,
        baseline_lst: baselineData.baseline_lst,
        ndvi_before: baselineData.ndvi_before || baselineData.baseline_ndvi,
        baseline_ndvi: baselineData.baseline_ndvi,
        coordinates: baselineData.coordinates
      }

      setSelectedWardData(wardData)
      setSelectedSentimentWard(wardNumber)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch ward data")
    }
  }

  const handleSimulate = async (incomingData: any) => {
    console.log("Receiving simulation data:", incomingData)

    try {
      const isFromEngine = incomingData.hasOwnProperty('temperatureReduction') || incomingData.hasOwnProperty('co2Offset');

      let normalized: SimulationData;

      if (isFromEngine) {
        normalized = {
          wardId: incomingData.wardId,
          wardName: incomingData.wardName,
          area: `${incomingData.wardName} (${(incomingData.area_sqkm || 1).toFixed(2)} km²)`,
          intervention: incomingData.intervention,
          intensity: incomingData.intensity,

          temperatureReduction: incomingData.temperatureReduction,
          lstBefore: incomingData.lstBefore,
          lstAfter: incomingData.lstAfter || (incomingData.lstBefore - incomingData.temperatureReduction),

          baseCooling: incomingData.baseCooling || 0,
          materialCooling: incomingData.materialCooling || 0,

          ndviBefore: incomingData.ndviBefore,
          ndviAfter: incomingData.ndviAfter,

          risk_before: incomingData.risk_before,
          risk_after: incomingData.risk_after,

          co2Offset: incomingData.co2Offset,
          materialCO2: incomingData.materialCO2 || 0,

          selectedMaterial: incomingData.selectedMaterial,
          coordinates: incomingData.coordinates
        };

      } else {
        console.log("running fallback simulation logic");

        const wardId = incomingData.ward_id || incomingData.wardId;
        const defaultIntensity = 0.15;

        const simRes = await fetch('http://localhost:8000/api/uhi/simulate-ward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ward_id: wardId, intensity: defaultIntensity })
        });

        const simResult = await simRes.json();

        const cooling = simResult.cooling || 0;
        const lstB = simResult.lst_before || 35;

        normalized = {
          wardId: wardId,
          wardName: simResult.ward_name,
          area: `${simResult.ward_name}`,
          intervention: "Quick Sim",
          intensity: 50,
          temperatureReduction: cooling,
          lstBefore: lstB,
          lstAfter: lstB - cooling,
          ndviBefore: simResult.ndvi_before || 0,
          ndviAfter: simResult.ndvi_after || 0,
          risk_before: simResult.risk_before || "Moderate",
          risk_after: simResult.risk_after || "Low",
          co2Offset: 0,
          coordinates: simResult.coordinates
        };
      }

      console.log("Final Normalized Data for Dashboard:", normalized)

      setSimulationData(normalized)
      setSelectedZone(normalized.area)
      setError(null)

      setTimeout(() => {
        setSimulationActive(true)
        setViewMode("simulated")
        if (normalized.coordinates) {
          updateUHIForSimulation(normalized)
        }
      }, 50)

    } catch (err) {
      setError("Failed to process simulation results")
    }
  }

  const handleWardSelection = (wardData: any) => {
    const normalizedWard = {
      ...wardData,
      ward_id: wardData.wardId || wardData.ward_id || wardData.ward_number,
      ward_name: wardData.name || wardData.ward_name,
      lst_before: wardData.lst_current || wardData.lst_before || wardData.baseline_lst,
      baseline_lst: wardData.lst_current || wardData.lst_before || wardData.baseline_lst,
      ndvi_before: wardData.ndvi_current || wardData.ndvi_before || wardData.baseline_ndvi,
      baseline_ndvi: wardData.ndvi_current || wardData.ndvi_before || wardData.baseline_ndvi,
      coordinates: wardData.coordinates || (wardData.lon && wardData.lat ? {
        lon: wardData.lon,
        lat: wardData.lat
      } : null)
    }
    setSelectedWardData(normalizedWard)
    setError(null)
  }

  const handleMaterialApplied = (materialData: any) => {
    console.log("Material applied:", materialData)

    setMaterialApplied(true)

    if (simulationActive && simulationData) {
      const updatedSimulation: SimulationData = {
        ...simulationData,
        selectedMaterial: materialData.selectedMaterial,
        temperatureReduction: simulationData.temperatureReduction + materialData.temperatureReduction,
        lstAfter: simulationData.lstAfter - materialData.temperatureReduction,
        materialCO2: (simulationData.materialCO2 || 0) + (materialData.co2Offset || 0),
        materialCooling: materialData.temperatureReduction,
        baseCooling: simulationData.baseCooling || simulationData.temperatureReduction,
      }

      console.log("Updated simulation with material:", updatedSimulation)

      setSimulationData(updatedSimulation)
      updateUHIForSimulation(updatedSimulation)

    } else {
      const coords = selectedWardData?.coordinates || { lon: 77.5946, lat: 12.9716 }

      const newSimulation: SimulationData = {
        wardId: selectedWardData?.ward_id || 0,
        wardName: selectedWardData?.ward_name || materialData.wardName || "Selected Area",
        area: selectedWardData?.ward_name || materialData.area || "Selected Area",
        intervention: "material application",
        intensity: 100,
        temperatureReduction: materialData.temperatureReduction,
        lstBefore: selectedWardData?.lst_before || selectedWardData?.baseline_lst || 35,
        lstAfter: (selectedWardData?.lst_before || selectedWardData?.baseline_lst || 35) - materialData.temperatureReduction,
        ndviBefore: selectedWardData?.ndvi_before || selectedWardData?.baseline_ndvi || 0.1,
        ndviAfter: selectedWardData?.ndvi_before || selectedWardData?.baseline_ndvi || 0.1,
        risk_before: selectedWardData?.risk_before || "Unknown",
        risk_after: "Improved",
        co2Offset: 0,
        materialCO2: materialData.co2Offset || 0,
        selectedMaterial: materialData.selectedMaterial,
        baseCooling: 0,
        materialCooling: materialData.temperatureReduction,
        coordinates: coords
      }

      console.log("New simulation from material:", newSimulation)

      setSimulationData(newSimulation)
      setSimulationActive(true)
      setViewMode("simulated")
      updateUHIForSimulation(newSimulation)
    }

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
          <h1 className="text-4xl font-black">Policy Analysis & Simulation Dashboard</h1>
          <p className="text-muted-foreground text-base">
            Evidence-based urban intervention modelling for Bengaluru Metropolitan Region
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Selected Ward Indicator */}
        {selectedWardData && !simulationActive && (
          <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg animate-in fade-in slide-in-from-top">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-emerald-500 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Selected: {selectedWardData.ward_name || selectedWardData.name}
                  {selectedSentimentWard && (
                    <Badge variant="outline" className="ml-2 text-xs border-emerald-500/50">
                      From Sentiment Analysis
                    </Badge>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  LST: {(selectedWardData.baseline_lst || selectedWardData.lst_before || 0).toFixed(2)}°C
                  {selectedWardData.ndvi_before && ` | NDVI: ${selectedWardData.ndvi_before.toFixed(3)}`}
                </p>
              </div>
              <Button onClick={() => handleSimulate(selectedWardData)} className="bg-emerald-600 hover:bg-emerald-700">
                Quick Run
              </Button>
            </div>
          </div>
        )}

        {/* Simulation Active Header */}
        {simulationActive && simulationData && (
          <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary animate-pulse" />
                <div>
                  <p className="font-semibold text-primary">Simulation Active</p>
                  <p className="text-sm text-muted-foreground">
                    {simulationData.wardName} • {simulationData.intervention} @ {simulationData.intensity}% intensity
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-primary/50">
                <TrendingDown className="h-3 w-3 mr-1" />
                {simulationData.temperatureReduction.toFixed(2)}°C reduction
              </Badge>
            </div>
          </div>
        )}

        {/* Mode Controls */}
        <div className="mb-6 flex items-center justify-between bg-card/50 backdrop-blur-sm rounded-lg p-4 border">
          <div className="flex items-center gap-4">
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
          <Button
            onClick={toggleComparison}
            disabled={!simulationActive}
            variant={comparisonMode ? "default" : "outline"}
            className="gap-2"
          >
            <SplitSquareHorizontal className="h-4 w-4" /> Comparative View
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Visualization3D onWardSelect={handleWardSelection} />
          <PolicySimulationEngine onSimulate={handleSimulate} />

          {simulationActive && simulationData && (
            <Card className="lg:col-span-2 p-8 border-primary/20 bg-linear-to-br from-primary/5 to-emerald-500/5">
              <div className="mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Thermometer className="h-5 w-5 text-primary" />
                  Impact Assessment Results
                </h3>
                <p className="text-sm text-muted-foreground">
                  Predicted outcomes for {simulationData.wardName}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-background p-6 rounded-2xl border shadow-sm">
                  <p className="text-xs font-bold text-muted-foreground mb-1 uppercase">Cooling Impact</p>
                  <p className="text-4xl font-black text-emerald-500">
                    -{simulationData.temperatureReduction.toFixed(2)}°C
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Temperature reduction achieved
                  </p>
                </div>

                <div className="bg-background p-6 rounded-2xl border shadow-sm">
                  <p className="text-xs font-bold text-muted-foreground mb-1 uppercase">Projected Temp</p>
                  <p className="text-4xl font-black">
                    {simulationData.lstAfter.toFixed(2)}°C
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    From {simulationData.lstBefore.toFixed(2)}°C baseline
                  </p>
                </div>

                <div className="bg-background p-6 rounded-2xl border shadow-sm">
                  <p className="text-xs font-bold text-muted-foreground mb-1 uppercase">Carbon Offset</p>
                  <p className="text-4xl font-black text-blue-500">
                    {simulationData.co2Offset.toLocaleString()} <span className="text-sm">t/y</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Annual CO₂ sequestration
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-background p-4 rounded-xl border flex justify-between items-center">
                  <p className="text-sm font-bold text-muted-foreground">RISK STATUS</p>
                  <p className="text-sm font-bold text-primary">
                    {simulationData.risk_before} → {simulationData.risk_after}
                  </p>
                </div>
                <div className="bg-background p-4 rounded-xl border flex justify-between items-center">
                  <p className="text-sm font-bold text-muted-foreground">NDVI SHIFT</p>
                  <p className="text-sm font-bold text-emerald-500">
                    {simulationData.ndviBefore.toFixed(3)} → {simulationData.ndviAfter.toFixed(3)}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSimulationActive(false);
                    setSimulationData(null);
                    setViewMode("baseline");
                    setSelectedSentimentWard(null);
                  }}
                >
                  Clear Simulation
                </Button>
                <Button
                className="flex-1 bg-primary"
                onClick={async () => {
                if (!simulationData) return;

                const response = await fetch("http://localhost:8000/api/export/pdf", {
                method: "POST",
                headers: {
                "Content-Type": "application/json"
                },
                body: JSON.stringify({
                generatedAt: new Date().toISOString(),
                viewMode,
                comparisonMode,
                simulationData
              })
              });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `EcoTwin_Report_${simulationData.wardName}.pdf`;
    a.click();
  }}
>
  <ArrowRight className="h-4 w-4 mr-2" />
  Export Results
</Button>

              </div>
            </Card>
          )}

          <InteractiveMap
            viewMode={viewMode}
            simulationActive={simulationActive}
            simulationData={simulationData}
            comparisonMode={comparisonMode}
          />
          <PredictedOutcomes
            simulationActive={simulationActive}
            simulationData={simulationData}
          />

          <div className="lg:col-span-2">
            <MaterialRecommender
              selectedZone={selectedWardData?.ward_name || selectedZone}
              onMaterialApplied={handleMaterialApplied}
            />
          </div>

          <div className="lg:col-span-2">
            <SentimentAnalysis />
          </div>
        </div>
      </div>
    </div>
  )
}