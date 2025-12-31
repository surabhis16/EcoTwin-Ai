import { Card } from "@/components/ui/card"
import { TrendingDown, TrendingUp, Leaf, Thermometer } from "lucide-react"

interface PredictedOutcomesProps {
  simulationActive: boolean
  simulationData: any | null
}

export function PredictedOutcomes({ simulationActive, simulationData }: PredictedOutcomesProps) {
  const getMetrics = () => {
    if (!simulationActive || !simulationData) {
      return {
        temp: 0,
        tempBefore: 0,
        tempAfter: 0,
        green: 0,
        ndviBefore: 0,
        ndviAfter: 0,
        emissions: 0,
        co2Offset: 0,
      }
    }

    const tempChange = simulationData.temperatureReduction ||
      (simulationData.lstBefore - simulationData.lstAfter) || 0

    // green cover change (NDVI absolute increase)
    const ndviBefore = simulationData.ndviBefore || 0
    const ndviAfter = simulationData.ndviAfter || 0
    const ndviChange = ndviAfter - ndviBefore
    const greenPercentChange = ndviChange * 100

    // CO2 emissions reduction
    const co2Offset = simulationData.co2Offset || 0

    // estimate emissions reduction percentage based on CO2 offset
    // assuming baseline emissions ~1000 tonnes/year for the ward
    const baselineEmissions = (simulationData.area_sqkm || 1) * 500
    const emissionsReduction = Math.min((co2Offset / baselineEmissions) * 100, 95) // cap at 95%

    return {
      temp: -tempChange, // Negative = cooling
      tempBefore: simulationData.lstBefore || 0,
      tempAfter: simulationData.lstAfter || 0,
      green: greenPercentChange,
      ndviBefore: ndviBefore,
      ndviAfter: ndviAfter,
      emissions: -Math.min(emissionsReduction, 100),
      co2Offset: co2Offset,
    }
  }

  const metrics = getMetrics()

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm">
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-1">Predicted Outcomes</h3>
        <p className="text-sm text-muted-foreground">
          {simulationActive && simulationData
            ? `Impact analysis for ${simulationData.wardName || simulationData.area || 'selected area'}`
            : "Run a simulation to see predicted impacts"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Temperature */}
        <div className={`bg-muted/50 rounded-lg p-4 transition-all ${simulationActive ? "border-2 border-blue-500/30 bg-blue-500/5" : ""
          }`}>
          <div className="flex items-center justify-between mb-2">
            <Thermometer className="h-5 w-5 text-blue-500" />
            {simulationActive && metrics.temp < 0 && (
              <TrendingDown className="h-4 w-4 text-blue-500" />
            )}
          </div>
          <p className="text-2xl font-bold text-blue-500">
            {simulationActive ? `${metrics.temp.toFixed(1)}°C` : "0°C"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {simulationActive
              ? `From ${metrics.tempBefore.toFixed(1)}°C → ${metrics.tempAfter.toFixed(1)}°C`
              : "Temperature change"}
          </p>
          {simulationActive && (
            <p className="text-xs text-blue-500 font-semibold mt-1">
              Cooling achieved
            </p>
          )}
        </div>

        {/* Green Cover (NDVI) */}
        <div className={`bg-muted/50 rounded-lg p-4 transition-all ${simulationActive ? "border-2 border-emerald-500/30 bg-emerald-500/5" : ""
          }`}>
          <div className="flex items-center justify-between mb-2">
            <Leaf className="h-5 w-5 text-emerald-500" />
            {simulationActive && metrics.green > 0 && (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            )}
          </div>
          <p className="text-2xl font-bold text-emerald-500">
            {simulationActive ? `+${metrics.green.toFixed(1)}%` : "0%"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {simulationActive
              ? `NDVI: ${metrics.ndviBefore.toFixed(3)} → ${metrics.ndviAfter.toFixed(3)}`
              : "Green cover increase"}
          </p>
          {simulationActive && (
            <p className="text-xs text-emerald-500 font-semibold mt-1">
              +{(metrics.green).toFixed(1)} percentage points
            </p>
          )}
        </div>

        {/* Air Quality - PLACEHOLDER */}
        <div className={`bg-muted/50 rounded-lg p-4 opacity-50`}>
          <div className="flex items-center justify-between mb-2">
            <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-muted-foreground">N/A</p>
          <p className="text-xs text-muted-foreground mt-1">Air quality data</p>
          <p className="text-xs text-muted-foreground/70 mt-1 italic">Coming soon</p>
        </div>

        {/* CO2 Emissions Reduction */}
        <div className={`bg-muted/50 rounded-lg p-4 transition-all ${simulationActive ? "border-2 border-primary/30 bg-primary/5" : ""
          }`}>
          <div className="flex items-center justify-between mb-2">
            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {simulationActive && metrics.emissions < 0 && (
              <TrendingDown className="h-4 w-4 text-primary" />
            )}
          </div>
          <p className="text-2xl font-bold text-primary">
            {simulationActive ? `${metrics.co2Offset.toFixed(0)} t/y` : "0 t/y"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {simulationActive
              ? `${metrics.emissions.toFixed(1)}% reduction estimate`
              : "CO₂ offset"}
          </p>
          {simulationActive && (
            <p className="text-xs text-primary font-semibold mt-1">
              Carbon sequestered
            </p>
          )}
        </div>
      </div>

      {/* Additional Context */}
      {simulationActive && simulationData && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Based on {simulationData.intervention || 'intervention'} at {simulationData.intensity || 0}% intensity
            {simulationData.selectedMaterial && ` using ${simulationData.selectedMaterial.name}`}
          </p>
        </div>
      )}
    </Card>
  )
}