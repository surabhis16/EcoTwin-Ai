"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Sparkles, ChevronRight, Check } from "lucide-react"
import { useState } from "react"

interface PolicySimulationEngineProps {
  onSimulate: (data: any) => void
}

export function PolicySimulationEngine({ onSimulate }: PolicySimulationEngineProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [area, setArea] = useState("")
  const [intervention, setIntervention] = useState("")
  const [intensity, setIntensity] = useState([50])
  const [isSimulating, setIsSimulating] = useState(false)
  const [areaData, setAreaData] = useState<any>(null)

  const steps = [
    { id: 1, name: "Select Area" },
    { id: 2, name: "Choose Intervention" },
    { id: 3, name: "Configure Intensity" },
    { id: 4, name: "Simulate Impact" },
    { id: 5, name: "Review Outcomes" },
  ]

  // Area coordinates with baseline NDVI for these areas (to give policy selection option)
  const areas: Record<string, { lon: number, lat: number, baseline_ndvi: number }> = {
    koramangala: { lon: 77.6269, lat: 12.9279, baseline_ndvi: 0.35 },
    whitefield: { lon: 77.7499, lat: 12.9698, baseline_ndvi: 0.25 },
    indiranagar: { lon: 77.6408, lat: 12.9716, baseline_ndvi: 0.30 },
    jayanagar: { lon: 77.5833, lat: 12.9250, baseline_ndvi: 0.40 },
    malleshwaram: { lon: 77.5703, lat: 13.0034, baseline_ndvi: 0.38 },
  }

  const handleNext = async () => {
    if (currentStep < 4) {
      // Fetch baseline data when area is selected
      if (currentStep === 1 && area) {
        await fetchAreaBaseline(area)
      }
      setCurrentStep(currentStep + 1)
    } else if (currentStep === 4) {
      await runSimulation()
    }
  }

  const fetchAreaBaseline = async (areaName: string) => {
    const coords = areas[areaName]
    if (!coords) return

    try {
      const response = await fetch('http://localhost:8000/api/uhi/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ndvi: coords.baseline_ndvi,
          lon: coords.lon,
          lat: coords.lat,
          green_cover_increase: 0 // current state (initial)
        })
      })

      const data = await response.json()
      setAreaData(data)
      //console.log(`Baseline for ${areaName}:`, data)
    } catch (err) {
      console.error("Failed to fetch baseline:", err)
    }
  }

  const runSimulation = async () => {
    setIsSimulating(true)

    try {
      const coords = areas[area]

      // Calculate NDVI increase based on intervention and intensity
      let ndviIncrease = 0
      if (intervention === "green") {
        // Green infrastructure: direct NDVI increase
        ndviIncrease = (intensity[0] / 100) * 0.3 // Max 0.3 NDVI increase at 100%
      } else if (intervention === "cooling") {
        // Cooling corridors: moderate NDVI increase + albedo effect
        ndviIncrease = (intensity[0] / 100) * 0.2
      } else if (intervention === "materials") {
        // Sustainable materials: small indirect greening effect
        ndviIncrease = (intensity[0] / 100) * 0.1
      }

      // Call api with params
      const response = await fetch('http://localhost:8000/api/uhi/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ndvi: coords.baseline_ndvi,
          lon: coords.lon,
          lat: coords.lat,
          green_cover_increase: ndviIncrease
        })
      })

      const prediction = await response.json()

      // Calculate CO2 sequestration 
      // Based on: 1 hectare of urban trees sequesters ~2.5 tons CO2/year
      const areaHectares = 100 // Assume 100 hectares per neighborhood
      const ndviGain = prediction.ndvi_after - prediction.ndvi_before
      const co2Offset = (ndviGain * areaHectares * 2.5 * 10).toFixed(0) // tons/year

      const result = {
        area,
        intervention,
        intensity: intensity[0],
        // data from api (prediction)
        temperatureReduction: prediction.cooling_effect,
        lstBefore: prediction.lst_before,
        lstAfter: prediction.lst_after,
        ndviBefore: prediction.ndvi_before,
        ndviAfter: prediction.ndvi_after,
        riskReduction: prediction.risk_reduction,
        co2Offset: parseFloat(co2Offset),
        // Metadata
        coordinates: { lon: coords.lon, lat: coords.lat }
      }

      console.log("Simulation Result:", result)

      onSimulate(result)
      setCurrentStep(5)

    } catch (err) {
      console.error("Simulation failed:", err)
      alert("Simulation failed. Is the backend running?")
    } finally {
      setIsSimulating(false)
    }
  }

  const handleReset = () => {
    setCurrentStep(1)
    setArea("")
    setIntervention("")
    setIntensity([50])
    setAreaData(null)
  }

  const canProceed = () => {
    if (currentStep === 1) return area !== ""
    if (currentStep === 2) return intervention !== ""
    return true
  }


  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold mb-1">Policy Simulation Engine</h3>
          <p className="text-sm text-muted-foreground">Model intervention impacts on city systems</p>
        </div>
        <Sparkles className="h-6 w-6 text-primary" />
      </div>

      {/* Step indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${currentStep === step.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : currentStep > step.id
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                >
                  {currentStep > step.id ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{step.id}</span>
                  )}
                </div>
                <p
                  className={`text-xs mt-2 text-center w-20 ${currentStep >= step.id ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}
                >
                  {step.name}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mb-6 mx-1 ${currentStep > step.id ? "bg-primary" : "bg-muted-foreground/30"}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="min-h-48 mb-6">
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="area">Target Area</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger id="area" className="mt-2">
                  <SelectValue placeholder="Choose a district" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="koramangala">Koramangala</SelectItem>
                  <SelectItem value="whitefield">Whitefield</SelectItem>
                  <SelectItem value="indiranagar">Indiranagar</SelectItem>
                  <SelectItem value="jayanagar">Jayanagar</SelectItem>
                  <SelectItem value="malleshwaram">Malleshwaram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {areaData && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="font-semibold mb-1">Baseline Data:</p>
                <p>Current Temperature: {areaData.lst_before.toFixed(2)}°C</p>
                <p>Risk Level: {areaData.risk_reduction.split(' → ')[0]}</p>
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="intervention">Intervention Type</Label>
              <Select value={intervention} onValueChange={setIntervention}>
                <SelectTrigger id="intervention" className="mt-2">
                  <SelectValue placeholder="Select policy intervention" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cooling">Urban Cooling Corridors</SelectItem>
                  <SelectItem value="green">Green Infrastructure Expansion</SelectItem>
                  <SelectItem value="materials">Sustainable Material Mandate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose the policy intervention to model on the selected area.
            </p>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="intensity">Implementation Intensity: {intensity[0]}%</Label>
              <Slider
                id="intensity"
                value={intensity}
                onValueChange={setIntensity}
                min={0}
                max={100}
                step={10}
                className="mt-4"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Pilot</span>
                <span>Full Scale</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Define the scale of implementation from pilot (20%) to full deployment (100%).
            </p>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Area</span>
                <span className="font-semibold capitalize">{area}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Intervention</span>
                <span className="font-semibold">
                  {intervention === "cooling" && "Urban Cooling Corridors"}
                  {intervention === "green" && "Green Infrastructure"}
                  {intervention === "materials" && "Sustainable Materials"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Intensity</span>
                <span className="font-semibold">{intensity[0]}%</span>
              </div>
              {areaData && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Baseline LST</span>
                    <span className="font-semibold">{areaData.lst_before.toFixed(2)}°C</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Baseline NDVI</span>
                    <span className="font-semibold">{areaData.ndvi_before.toFixed(3)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <p className="text-sm font-semibold text-primary mb-2">Simulation Complete</p>
              <p className="text-sm text-muted-foreground">
                The predicted outcomes are now visible in the map and metrics panels. Review the baseline vs simulated
                comparison to assess policy impact.
              </p>
            </div>
            <Button onClick={handleReset} variant="outline" className="w-full bg-transparent">
              Run New Simulation
            </Button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {currentStep < 5 && (
        <div className="flex gap-3">
          {currentStep > 1 && (
            <Button onClick={() => setCurrentStep(currentStep - 1)} variant="outline" className="flex-1">
              Back
            </Button>
          )}
          <Button onClick={handleNext} disabled={!canProceed() || isSimulating} className="flex-1">
            {isSimulating ? (
              <>Running simulation...</>
            ) : currentStep === 4 ? (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Run Impact Prediction
              </>
            ) : (
              <>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  )
}
