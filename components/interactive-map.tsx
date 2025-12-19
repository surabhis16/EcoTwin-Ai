"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, LayersIcon } from "lucide-react"
import { useState } from "react"

interface InteractiveMapProps {
  viewMode: "baseline" | "simulated"
  simulationActive: boolean
  simulationData: {
    area: string
    intervention: string
    intensity: number
  } | null
  comparisonMode: boolean
}

export function InteractiveMap({ viewMode, simulationActive, simulationData, comparisonMode }: InteractiveMapProps) {
  const [activeLayer, setActiveLayer] = useState<"heat" | "green" | "pollution">("heat")

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold mb-1">Urban Heat Island Map</h3>
          <p className="text-sm text-muted-foreground">Real-time temperature distribution</p>
        </div>
        <MapPin className="h-6 w-6 text-primary" />
      </div>

      <div
        className={`relative h-80 rounded-lg bg-muted/30 mb-4 overflow-hidden ${comparisonMode ? "grid grid-cols-2 gap-1" : ""}`}
      >
        {comparisonMode ? (
          <>
            {/* Baseline view */}
            <div className="relative h-full">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <LayersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs font-semibold text-foreground mb-1">Baseline</p>
                  <p className="text-xs text-muted-foreground">Current State</p>
                </div>
              </div>
              <div className="absolute top-2 left-2 text-xs bg-background/90 backdrop-blur-sm px-2 py-1 rounded font-semibold">
                BEFORE
              </div>
            </div>

            {/* Simulated view */}
            <div className="relative h-full">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <LayersIcon className="h-12 w-12 text-primary mx-auto mb-2" />
                  <p className="text-xs font-semibold text-primary mb-1">Simulated</p>
                  <p className="text-xs text-muted-foreground">+5 Years</p>
                </div>
              </div>
              <div className="absolute top-2 left-2 text-xs bg-primary/90 backdrop-blur-sm px-2 py-1 rounded font-semibold text-primary-foreground">
                AFTER
              </div>

              {simulationActive && simulationData && (
                <div className="absolute bottom-2 left-2 right-2 bg-primary/20 backdrop-blur-sm border border-primary/50 rounded-lg p-2">
                  <p className="text-xs font-semibold text-primary mb-0.5">
                    {simulationData.intervention === "cooling" && "Cooling Corridor Applied"}
                    {simulationData.intervention === "green" && "Green Infrastructure Deployed"}
                    {simulationData.intervention === "materials" && "High Eco-Score Materials Applied"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {simulationData.area} • Intensity: {simulationData.intensity}%
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Single view mode */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <LayersIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Interactive map visualization</p>
              </div>
            </div>

            {simulationActive && viewMode === "simulated" && simulationData && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary/20 backdrop-blur-sm border-2 border-primary/50 rounded-lg p-4 min-w-64">
                <p className="text-sm font-semibold text-primary mb-1">
                  {simulationData.intervention === "cooling" && "Cooling Corridor Applied"}
                  {simulationData.intervention === "green" && "Green Infrastructure Deployed"}
                  {simulationData.intervention === "materials" && "High Eco-Score Materials Applied"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {simulationData.area} • Intensity: {simulationData.intensity}%
                </p>
              </div>
            )}

            {/* Heat overlay indicators */}
            <div className="absolute top-4 left-4 space-y-2">
              <div className="flex items-center gap-2 text-xs bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <span>High Heat (35°C+)</span>
              </div>
              <div className="flex items-center gap-2 text-xs bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg">
                <div className="h-3 w-3 rounded-full bg-accent" />
                <span>Moderate Heat (28-35°C)</span>
              </div>
              <div className="flex items-center gap-2 text-xs bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg">
                <div className="h-3 w-3 rounded-full bg-chart-3" />
                <span>Cool Zones (below 28°C)</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant={activeLayer === "heat" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveLayer("heat")}
        >
          Heat Map
        </Button>
        <Button
          variant={activeLayer === "green" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveLayer("green")}
        >
          Green Cover
        </Button>
        <Button
          variant={activeLayer === "pollution" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveLayer("pollution")}
        >
          Air Quality
        </Button>
      </div>
    </Card>
  )
}
