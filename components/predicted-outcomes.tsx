"use client"

import { Card } from "@/components/ui/card"
import { TrendingDown, TrendingUp, Leaf, Thermometer } from "lucide-react"

interface PredictedOutcomesProps {
  simulationActive: boolean
  simulationData: {
    area: string
    intervention: string
    intensity: number
  } | null
}

export function PredictedOutcomes({ simulationActive, simulationData }: PredictedOutcomesProps) {
  // Calculate predicted changes based on intervention
  const getMetrics = () => {
    if (!simulationActive || !simulationData) {
      return {
        temp: 0,
        green: 0,
        quality: 0,
        emissions: 0,
      }
    }

    const factor = simulationData.intensity / 100

    if (simulationData.intervention === "cooling") {
      return {
        temp: -2.5 * factor,
        green: 12 * factor,
        quality: 18 * factor,
        emissions: -15 * factor,
      }
    } else if (simulationData.intervention === "green") {
      return {
        temp: -1.8 * factor,
        green: 25 * factor,
        quality: 22 * factor,
        emissions: -20 * factor,
      }
    } else {
      return {
        temp: -1.2 * factor,
        green: 8 * factor,
        quality: 15 * factor,
        emissions: -30 * factor,
      }
    }
  }

  const metrics = getMetrics()

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm">
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-1">Predicted Outcomes</h3>
        <p className="text-sm text-muted-foreground">
          {simulationActive
            ? "Projected city state after 5 years of intervention"
            : "Run a simulation to see predicted impacts"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className={`bg-muted/50 rounded-lg p-4 ${simulationActive ? "border-2 border-primary/30" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <Thermometer className="h-5 w-5 text-chart-1" />
            {simulationActive && metrics.temp < 0 && <TrendingDown className="h-4 w-4 text-primary" />}
          </div>
          <p className="text-2xl font-bold">{simulationActive ? `${metrics.temp.toFixed(1)}°C` : "0°C"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {simulationActive ? "Change from baseline" : "Temperature change"}
          </p>
          {simulationActive && <p className="text-xs text-primary font-semibold mt-1">Predicted improvement</p>}
        </div>

        <div className={`bg-muted/50 rounded-lg p-4 ${simulationActive ? "border-2 border-primary/30" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <Leaf className="h-5 w-5 text-chart-2" />
            {simulationActive && metrics.green > 0 && <TrendingUp className="h-4 w-4 text-primary" />}
          </div>
          <p className="text-2xl font-bold">{simulationActive ? `+${metrics.green.toFixed(0)}%` : "0%"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {simulationActive ? "Change from baseline" : "Green cover increase"}
          </p>
          {simulationActive && <p className="text-xs text-primary font-semibold mt-1">Predicted improvement</p>}
        </div>

        <div className={`bg-muted/50 rounded-lg p-4 ${simulationActive ? "border-2 border-primary/30" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <svg className="h-5 w-5 text-chart-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
              />
            </svg>
            {simulationActive && metrics.quality > 0 && <TrendingUp className="h-4 w-4 text-primary" />}
          </div>
          <p className="text-2xl font-bold">{simulationActive ? `+${metrics.quality.toFixed(0)}%` : "0%"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {simulationActive ? "Change from baseline" : "Air quality improvement"}
          </p>
          {simulationActive && <p className="text-xs text-primary font-semibold mt-1">Predicted improvement</p>}
        </div>

        <div className={`bg-muted/50 rounded-lg p-4 ${simulationActive ? "border-2 border-primary/30" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <svg className="h-5 w-5 text-chart-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {simulationActive && metrics.emissions < 0 && <TrendingDown className="h-4 w-4 text-primary" />}
          </div>
          <p className="text-2xl font-bold">{simulationActive ? `${metrics.emissions.toFixed(0)}%` : "0%"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {simulationActive ? "Change from baseline" : "Emissions reduction"}
          </p>
          {simulationActive && <p className="text-xs text-primary font-semibold mt-1">Predicted improvement</p>}
        </div>
      </div>
    </Card>
  )
}
