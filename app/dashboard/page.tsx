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

  // Temperature metrics
  temperatureReduction: number
  lstBefore: number
  lstAfter: number

  // NDVI metrics
  ndviBefore: number
  ndviAfter: number

  // Risk assessment
  risk_before: string
  risk_after: string

  // Impact metrics
  co2Offset: number

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

  const handleSimulate = (rawData: any) => {
    console.log("Raw API Data Received:", rawData);

    // Extract values with proper type conversion
    const wardId = typeof rawData.ward_id === 'string' ? parseInt(rawData.ward_id) : (rawData.wardId ?? rawData.ward_id ?? 0);
    const wardName = rawData.ward_name ?? rawData.wardName ?? `Ward ${wardId}`;
    const intervention = rawData.intervention ?? "green cover enhancement";
    const intensity = typeof rawData.intensity === 'string' ? parseFloat(rawData.intensity) : (rawData.intensity ?? 50);

    // Temperature metrics 
    const cooling = typeof rawData.cooling === 'string' ? parseFloat(rawData.cooling) :
      (rawData.cooling ?? rawData.cooling_effect ?? rawData.temperatureReduction ?? rawData.temperature_reduction ?? 0);
    const lstBefore = typeof rawData.lst_before === 'string' ? parseFloat(rawData.lst_before) :
      (rawData.lstBefore ?? rawData.lst_before ?? rawData.baseline_lst ?? 0);
    const lstAfter = typeof rawData.lst_after === 'string' ? parseFloat(rawData.lst_after) :
      (rawData.lstAfter ?? rawData.lst_after ?? 0);

    // NDVI metrics 
    const ndviBefore = typeof rawData.ndvi_before === 'string' ? parseFloat(rawData.ndvi_before) :
      (rawData.ndviBefore ?? rawData.ndvi_before ?? rawData.baseline_ndvi ?? 0);
    const ndviAfter = typeof rawData.ndvi_after === 'string' ? parseFloat(rawData.ndvi_after) :
      (rawData.ndviAfter ?? rawData.ndvi_after ?? 0);

    // Calculate CO2 offset from NDVI change
    const ndviGain = ndviAfter - ndviBefore;
    const areaSqKm = rawData.area_sqkm || 1;
    const areaHectares = areaSqKm * 100;
    const co2Offset = Math.round(Math.max(0, ndviGain) * areaHectares * 25);

    // Risk assessment 
    const riskBefore = rawData.riskBefore ?? rawData.risk_before ?? rawData.riskReduction?.split(' → ')[0] ?? "Unknown";
    const riskAfter = rawData.riskAfter ?? rawData.risk_after ?? rawData.riskReduction?.split(' → ')[1] ?? "Unknown";

    // Coordinates
    const coordinates = rawData.coordinates ?? { lon: 77.5946, lat: 12.9716 };

    // Build normalized object with all required fields
    const normalized: SimulationData = {
      // Identification
      wardId: wardId,
      wardName: wardName,
      area: `${wardName} (${areaSqKm.toFixed(2)} km²)`,
      intervention: intervention,
      intensity: intensity,

      // Temperature metrics
      temperatureReduction: cooling,
      lstBefore: lstBefore,
      lstAfter: lstAfter,

      // NDVI metrics
      ndviBefore: ndviBefore,
      ndviAfter: ndviAfter,

      // Risk assessment
      risk_before: riskBefore,
      risk_after: riskAfter,

      // Impact
      co2Offset: co2Offset,

      // Coordinates for map
      coordinates: coordinates
    };

    console.log("Normalized Data:", normalized);
    console.log("Cooling:", cooling, "LST Before:", lstBefore, "LST After:", lstAfter);
    console.log("NDVI Before:", ndviBefore, "NDVI After:", ndviAfter, "CO2:", co2Offset);

    setSimulationData(normalized);
    setSimulationActive(true);
    setViewMode("simulated");
    setSelectedZone(normalized.area);

    if (normalized.coordinates) {
      updateUHIForSimulation(normalized);
    }
  };

  const handleWardSelection = (wardData: any) => {
    console.log("Ward selected in dashboard:", wardData);
    setSelectedWardData(wardData)
  }

  const handleMaterialApplied = (materialData: any) => {
    console.log("Material applied:", materialData)

    setMaterialApplied(true)

    // If there are ward coordinates, visualize on map
    if (selectedWardData?.coordinates || simulationData?.coordinates) {
      const coords = selectedWardData?.coordinates || simulationData?.coordinates

      const visualizationData = {
        ...materialData,
        coordinates: coords,
        wardName: selectedWardData?.ward_name || materialData.wardName,
        lstBefore: selectedWardData?.baseline_lst || 35,
        lstAfter: (selectedWardData?.baseline_lst || 35) - materialData.temperatureReduction,
        ndviBefore: selectedWardData?.ndvi_before || 0.1,
        ndviAfter: selectedWardData?.ndvi_before || 0.1,
        risk_before: selectedWardData?.risk_before || "Unknown",
        risk_after: "Improved",
        baseCooling: 0,
        materialCooling: materialData.temperatureReduction
      }

      updateUHIForSimulation(visualizationData)
    }

    // Auto-hide after 5 seconds
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

        {/* Status/Ward Indicator */}
        {selectedWardData && !simulationActive && (
          <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg animate-in fade-in slide-in-from-top">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-emerald-500 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Selected: {selectedWardData.ward_name || selectedWardData.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  LST: {(selectedWardData.baseline_lst || selectedWardData.lst_before || selectedWardData.lst || 0).toFixed(2)}°C
                  {selectedWardData.ndvi_before && ` | NDVI: ${selectedWardData.ndvi_before.toFixed(3)}`}
                </p>
              </div>
              <Button onClick={() => handleSimulate(selectedWardData)} className="bg-emerald-600 hover:bg-emerald-700">
                Run Simulation
              </Button>
            </div>
          </div>
        )}

        {/* Simulation Active Indicator */}
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
          {/* Main Simulation Tools */}
          <Visualization3D onWardSelect={handleWardSelection} />
          <PolicySimulationEngine onSimulate={handleSimulate} />

          {/* Simulation Results Card */}
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
                {/* Cooling Impact */}
                <div className="bg-background p-6 rounded-2xl border shadow-sm">
                  <p className="text-xs font-bold text-muted-foreground mb-1 uppercase">Cooling Impact</p>
                  <p className="text-4xl font-black text-emerald-500">
                    {(simulationData.temperatureReduction || 0).toFixed(2)}°C
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Temperature reduction achieved
                  </p>
                </div>

                {/* Projected Temp */}
                <div className="bg-background p-6 rounded-2xl border shadow-sm">
                  <p className="text-xs font-bold text-muted-foreground mb-1 uppercase">Projected Temp</p>
                  <p className="text-4xl font-black">
                    {(simulationData.lstAfter || 0).toFixed(2)}°C
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    From {(simulationData.lstBefore || 0).toFixed(2)}°C baseline
                  </p>
                </div>

                {/* Carbon Offset */}
                <div className="bg-background p-6 rounded-2xl border shadow-sm">
                  <p className="text-xs font-bold text-muted-foreground mb-1 uppercase">Carbon Offset</p>
                  <p className="text-4xl font-black text-blue-500">
                    {simulationData.co2Offset || 0} <span className="text-sm">t/y</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Annual CO₂ sequestration
                  </p>
                </div>
              </div>

              {/* Risk and NDVI Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-background p-4 rounded-xl border flex justify-between items-center">
                  <p className="text-sm font-bold text-muted-foreground">RISK STATUS</p>
                  <p className="text-sm font-bold text-primary">
                    {simulationData.risk_before || 'Unknown'} → {simulationData.risk_after || 'Unknown'}
                  </p>
                </div>
                <div className="bg-background p-4 rounded-xl border flex justify-between items-center">
                  <p className="text-sm font-bold text-muted-foreground">NDVI SHIFT</p>
                  <p className="text-sm font-bold text-emerald-500">
                    {(simulationData.ndviBefore || 0).toFixed(3)} → {(simulationData.ndviAfter || 0).toFixed(3)}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSimulationActive(false);
                    setSimulationData(null);
                    setViewMode("baseline");
                  }}
                >
                  Clear Simulation
                </Button>
                <Button
                  className="flex-1 bg-primary"
                  onClick={() => {
                    // alert("Simulation results would be exported here");
                  }}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Export Results
                </Button>
              </div>
            </Card>
          )}

          {/* Dashboard Components */}
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
          <SentimentAnalysis />
          <MaterialRecommender
            selectedZone={selectedWardData?.ward_name || selectedZone}
            onMaterialApplied={handleMaterialApplied}
          />
        </div>
      </div>
    </div>
  )
}