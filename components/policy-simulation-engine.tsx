"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Sparkles, ChevronRight, Check, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"

interface PolicySimulationEngineProps {
  onSimulate: (data: any) => void
}

export function PolicySimulationEngine({ onSimulate }: PolicySimulationEngineProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [wardId, setWardId] = useState("")
  const [intervention, setIntervention] = useState("")
  const [intensity, setIntensity] = useState([50])
  const [loading, setLoading] = useState(false)
  const [wards, setWards] = useState<{ id: number; name: string }[]>([])
  const [areaData, setAreaData] = useState<any>(null)
  const [simulationResult, setSimulationResult] = useState<any>(null)

  const steps = [
    { id: 1, name: "Select Ward" },
    { id: 2, name: "Choose Intervention" },
    { id: 3, name: "Configure Intensity" },
    { id: 4, name: "Review & Simulate" },
    { id: 5, name: "Results" },
  ]

  // Load all wards from DB on mount
  useEffect(() => {
    fetch('http://localhost:8000/api/uhi/wards-metadata')
      .then(res => res.json())
      .then(setWards)
      .catch(console.error)
  }, [])

  // Fetch baseline data when ward is selected
  const fetchWardBaseline = async (wId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/uhi/ward-baseline/${wId}`)
      const data = await response.json()
      setAreaData(data)
    } catch (err) {
      console.error("Failed to fetch ward baseline:", err)
    }
  }

  const handleNext = async () => {
    if (currentStep < 4) {
      // Fetch baseline when ward is selected
      if (currentStep === 1 && wardId && !areaData) {
        await fetchWardBaseline(wardId)
      }
      setCurrentStep(currentStep + 1)
    } else if (currentStep === 4) {
      await runSimulation()
    }
  }

  const runSimulation = async () => {
    setLoading(true)

    try {
      // Calculate NDVI increase based on intervention and intensity
      let ndviIncrease = 0
      if (intervention === "green") {
        ndviIncrease = (intensity[0] / 100) * 0.3 // Max 0.3 NDVI increase
      } else if (intervention === "cooling") {
        ndviIncrease = (intensity[0] / 100) * 0.2 // Moderate increase + albedo
      } else if (intervention === "materials") {
        ndviIncrease = (intensity[0] / 100) * 0.1 // Small indirect effect
      }

      const res = await fetch('http://localhost:8000/api/uhi/simulate-ward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ward_id: parseInt(wardId),
          intensity: ndviIncrease
        })
      })

      const prediction = await res.json()

      // Calculate CO2 sequestration
      const areaSqKm = areaData?.area_sqkm || 1;
      const areaHectares = areaSqKm * 100;
      const ndviGain = prediction.ndvi_after - prediction.ndvi_before
      const co2Offset = Math.max(0, ndviGain) * areaHectares * 25;
      const treeEquivalent = Math.round(co2Offset / 0.022);
      const carEquivalent = Math.round(co2Offset / 4.6);

      const result = {
        wardId,
        wardName: wards.find(w => w.id === parseInt(wardId))?.name,
        intervention,
        intensity: intensity[0],
        temperatureReduction: prediction.cooling_effect,
        area_sqkm: areaSqKm,
        lstBefore: prediction.lst_before,
        lstAfter: prediction.lst_after,
        ndviBefore: prediction.ndvi_before,
        ndviAfter: prediction.ndvi_after,
        riskReduction: prediction.risk_reduction,
        co2Offset: parseFloat(co2Offset.toFixed(0)),
        treeEquivalent: treeEquivalent,
        carEquivalent: carEquivalent
      }

      setSimulationResult(result);
      onSimulate(result);
      setCurrentStep(5);
    } catch (err) {
      console.error("Simulation failed:", err)
      alert("Simulation failed. Check backend connection.")
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setCurrentStep(1)
    setWardId("")
    setIntervention("")
    setIntensity([50])
    setAreaData(null)
  }

  const canProceed = () => {
    if (currentStep === 1) return wardId !== ""
    if (currentStep === 2) return intervention !== ""
    return true
  }

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
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
                  className={`w-12 h-0.5 mb-6 mx-1 ${currentStep > step.id ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
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
              <Label htmlFor="ward">Select Ward</Label>
              <Select value={wardId} onValueChange={(val) => { setWardId(val); fetchWardBaseline(val); }}>
                <SelectTrigger id="ward" className="mt-2">
                  <SelectValue placeholder={wards.length ? "Choose from 225 wards..." : "Loading wards..."} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {wards.map(w => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      {w.name} (Ward {w.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {areaData && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="font-semibold mb-1">Baseline Data:</p>
                <p>Current Temperature: {areaData.lst_before?.toFixed(2)}°C</p>
                <p>Current NDVI: {areaData.ndvi_before?.toFixed(3)}</p>
                {areaData.risk_reduction && (
                  <p>Risk Level: {areaData.risk_reduction.split(' → ')[0]}</p>
                )}
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
              Choose the policy intervention to model on the selected ward.
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
                step={5}
                className="mt-4"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Pilot</span>
                <span>Full Scale</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Mapping {intensity[0]}% effort to +{((intensity[0] / 100) * (intervention === "green" ? 0.3 : intervention === "cooling" ? 0.2 : 0.1)).toFixed(2)} NDVI increase.
            </p>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Ward</span>
                <span className="font-semibold">
                  {wards.find(w => w.id === parseInt(wardId))?.name} (#{wardId})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Physical Area</span>
                <span className="font-semibold text-emerald-500">
                  {areaData?.area_sqkm ? `${areaData.area_sqkm.toFixed(2)} km²` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Intervention</span>
                <span className="font-semibold">
                  {intervention === "cooling" && "Urban Cooling Corridors"}
                  {intervention === "green" && "Green Infrastructure"}
                  {intervention === "materials" && "Sustainable Materials"}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-border/50 pt-2 mt-2">
                <span className="text-sm text-muted-foreground">Baseline LST / NDVI</span>
                <span className="font-semibold text-sm">
                  {areaData?.lst_before?.toFixed(1)}°C / {areaData?.ndvi_before?.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Simulation Intensity</span>
                <span className="font-semibold">{intensity[0]}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Target NDVI Gain</span>
                <span className="font-medium text-emerald-500">
                  +{((intensity[0] / 100) * (intervention === "green" ? 0.3 : intervention === "cooling" ? 0.2 : 0.1)).toFixed(2)}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center italic">
              Sequestration will be calculated across {(areaData?.area_sqkm * 100).toFixed(0)} hectares.
            </p>
          </div>
        )}

        {currentStep === 5 && simulationResult && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center justify-center p-6 bg-primary/5 rounded-2xl border border-primary/20">
              <Check className="h-10 w-10 text-primary mb-2" />
              <p className="font-bold text-primary text-center">Impact Modeled Successfully</p>
              <p className="text-xs text-muted-foreground text-center mb-4">
                Results for {simulationResult.wardName}
              </p>

              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="bg-background/50 p-3 rounded-lg border border-emerald-500/20">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Nature Impact</p>
                  <p className="text-lg font-black text-emerald-500">
                    ~{simulationResult.treeEquivalent.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Mature Trees</p>
                </div>

                <div className="bg-background/50 p-3 rounded-lg border border-blue-500/20">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Carbon Offset</p>
                  <p className="text-lg font-black text-blue-500">
                    ~{simulationResult.carEquivalent.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Cars/yr removed</p>
                </div>
              </div>
            </div>

            <Button onClick={handleReset} variant="outline" className="w-full">
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
          <Button onClick={handleNext} disabled={!canProceed() || loading} className="flex-1">
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Running simulation...
              </>
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