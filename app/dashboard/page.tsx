"use client"

import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { LogOut } from "lucide-react"
import { DashboardNav } from "@/components/dashboard-nav"
import { InteractiveMap } from "@/components/interactive-map"
import { SentimentAnalysis } from "@/components/sentiment-analysis"
import MaterialRecommender from "@/components/material-recommender"
import PolicySimulationEngine from "@/components/policy-simulation-engine"
import { FeasibilityAnalysis } from "@/components/feasibility-analysis"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  TrendingDown,
  Thermometer,
  MapPin,
  ArrowRight,
} from "lucide-react"
import { useState } from "react"
import dynamic from "next/dynamic"
import { updateUHIForSimulation } from "@/components/visualization-3d"
import AgentChat from "@/components/agentchat"
import GlobalFeatureImportance from "@/components/global-feature-imp"
import EquityAuditPanel from "@/components/equity-audit-panel"

interface SimulationData {
  wardId: number
  wardName: string
  area: string
  intervention: string
  intensity: number
  temperatureReduction: number
  lstBefore: number
  lstAfter: number
  baseCooling?: number
  materialCooling?: number
  ndviBefore: number
  ndviAfter: number
  risk_before: string
  risk_after: string
  co2Offset: number
  materialCO2?: number
  selectedMaterial?: any
  coordinates?: { lon: number; lat: number }
}

const Visualization3D = dynamic(
  () => import("@/components/visualization-3d").then(m => m.Visualization3D),
  { ssr: false }
)

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  const [viewMode, setViewMode] = useState<"baseline" | "simulated">("baseline")
  const [comparisonMode, setComparisonMode] = useState(false)
  const [simulationActive, setSimulationActive] = useState(false)
  const [simulationData, setSimulationData] = useState<SimulationData | null>(null)
  const [selectedZone, setSelectedZone] = useState<string>("")
  const [materialApplied, setMaterialApplied] = useState(false)
  const [selectedWardData, setSelectedWardData] = useState<any>(null)
  const [selectedSentimentWard, setSelectedSentimentWard] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push("/")
  }, [user, loading])

  if (loading || !user) return null

  const calculateSecondaryMetrics = (data: SimulationData) => {
    const energySavingsPercent = (data.temperatureReduction * 7.5).toFixed(1)
    const carEquivalent = Math.floor(data.co2Offset / 4.6)
    const pricePerSqm = data.selectedMaterial ? (data.selectedMaterial.price_inr_per_m3 / 10 || 500) : 450
    const wardAreaSqKm = 2.5
    const areaM2 = wardAreaSqKm * 1000000
    const coveragePercent = data.intensity / 100
    const estimatedCostCr = (areaM2 * coveragePercent * pricePerSqm) / 10000000

    return { energySavingsPercent, carEquivalent, estimatedCostCr: estimatedCostCr.toFixed(2) }
  }

  const secondaryMetrics = simulationData ? calculateSecondaryMetrics(simulationData) : null

  const handleSimulate = async (incomingData: any) => {
    try {
      const isFromEngine = incomingData.hasOwnProperty('temperatureReduction') || incomingData.hasOwnProperty('co2Offset');
      let normalized: SimulationData;

      if (isFromEngine) {
        normalized = {
          wardId: incomingData.wardId,
          wardName: incomingData.wardName,
          area: `${incomingData.wardName}`,
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
        const wardId = incomingData.ward_id || incomingData.wardId;
        const simRes = await fetch('http://localhost:8000/api/uhi/simulate-ward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ward_id: wardId, intensity: 0.15 })
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
    setMaterialApplied(true)
    if (simulationActive && simulationData) {
      const updatedSimulation: SimulationData = {
        ...simulationData,
        selectedMaterial: materialData.selectedMaterial,
        temperatureReduction: simulationData.temperatureReduction + materialData.temperatureReduction,
        lstAfter: simulationData.lstAfter - materialData.temperatureReduction,
        materialCO2: (simulationData.materialCO2 || 0) + (materialData.co2Offset || 0),
        materialCooling: materialData.temperatureReduction,
      }
      setSimulationData(updatedSimulation)
      updateUHIForSimulation(updatedSimulation)
    } else {
      handleSimulate({
        ...selectedWardData,
        wardId: selectedWardData?.ward_id,
        wardName: selectedWardData?.ward_name || "Zone",
        intervention: "Material",
        intensity: 100,
        temperatureReduction: materialData.temperatureReduction,
        co2Offset: materialData.co2Offset || 0
      })
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
      {/* Signout bar */}
      <div className="border-b border-border/40 bg-background/80 backdrop-blur-sm px-6 py-2 flex justify-end items-center gap-3">
        <span className="text-sm text-muted-foreground">{user.email}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => { await signOut(); router.push("/") }}
          className="text-muted-foreground hover:text-foreground gap-2"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
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
                </p>
                <p className="text-sm text-muted-foreground">
                  LST: {(selectedWardData.baseline_lst || selectedWardData.lst_before || 0).toFixed(2)}°C
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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 bg-card/50 backdrop-blur-sm rounded-lg p-4 border">
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

        </div>

        <div className="grid gap-3 lg:grid-cols-12">

          {/* Main map + full-width context */}
          <div className="lg:col-span-7 grid gap-3">
            <div className="min-h-[500px] flex flex-col">
              <Visualization3D onWardSelect={handleWardSelection} />
            </div>

            <div>
              <GlobalFeatureImportance />
            </div>
          </div>

          {/* Right sidebar: engine */}
          <div className="lg:col-span-5">
            <PolicySimulationEngine onSimulate={handleSimulate} />
          </div>

          {/* Impact Snapshot + Feasibility side by side */}
          {simulationActive && simulationData && (
            <div className="lg:col-span-6">
              <Card className="p-6 border-primary/20 bg-linear-to-br from-primary/5 to-emerald-500/5 shadow-lg h-full">
                <div className="mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Thermometer className="h-5 w-5 text-primary" />
                    Impact Snapshot
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Quick view of projected outcomes for {simulationData.wardName}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-background/80 p-4 rounded-2xl border shadow-sm">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Cooling Impact</p>
                    <p className="text-3xl font-black text-emerald-500">-{simulationData.temperatureReduction.toFixed(2)}°C</p>
                  </div>
                  <div className="bg-background/80 p-4 rounded-2xl border shadow-sm">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Projected Temp</p>
                    <p className="text-3xl font-black">{simulationData.lstAfter.toFixed(2)}°C</p>
                  </div>
                  <div className="bg-background/80 p-4 rounded-2xl border shadow-sm">
                    <p className="text-xs font-bold text-muted-foreground uppercase">CO₂ Offset</p>
                    <p className="text-3xl font-black text-blue-500">{simulationData.co2Offset.toLocaleString()} t/y</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 mt-4">
                  <div className="bg-background/80 p-4 rounded-xl border flex justify-between items-center">
                    <p className="text-sm font-bold text-muted-foreground">Risk Status</p>
                    <p className="text-sm font-bold text-primary">
                      {simulationData.risk_before} → {simulationData.risk_after}
                    </p>
                  </div>
                  <div className="bg-background/80 p-4 rounded-xl border flex justify-between items-center">
                    <p className="text-sm font-bold text-muted-foreground">NDVI Shift</p>
                    <p className="text-sm font-bold text-emerald-500">
                      {simulationData.ndviBefore.toFixed(3)} → {simulationData.ndviAfter.toFixed(3)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <Button
                    variant="outline"
                    className="w-full"
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
                    className="w-full bg-primary text-primary-foreground"
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
                      a.download = `UHI_Report_${simulationData.wardName}.pdf`;
                      a.click();
                    }}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Export Results
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {simulationActive && secondaryMetrics && (
            <div className="lg:col-span-6">
              <FeasibilityAnalysis metrics={secondaryMetrics} />
            </div>
          )}

          {/* Urban Heat Island map spans full width below cards */}
          <div className="lg:col-span-12 h-full min-h-[450px] transition-all duration-500">
            <InteractiveMap
              viewMode={viewMode}
              simulationActive={simulationActive}
              simulationData={simulationData}
              comparisonMode={comparisonMode}
            />
          </div>
        </div>

        <Tabs defaultValue="materials" className="mt-6">
          <TabsList className="mb-4 grid h-auto w-full grid-cols-2 md:w-fit md:grid-cols-4">
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="equity">Equity Audit</TabsTrigger>
            <TabsTrigger value="agent">Agent</TabsTrigger>
            <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
          </TabsList>

          <TabsContent value="materials">
            <MaterialRecommender
              selectedZone={selectedWardData?.ward_name || selectedZone}
              onMaterialApplied={handleMaterialApplied}
            />
          </TabsContent>

          <TabsContent value="equity">
            <EquityAuditPanel />
          </TabsContent>

          <TabsContent value="agent">
            <AgentChat />
          </TabsContent>

          <TabsContent value="sentiment">
            <SentimentAnalysis />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
