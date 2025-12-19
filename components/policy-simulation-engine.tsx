"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Sparkles, ChevronRight, Check } from "lucide-react"
import { useState } from "react"

interface PolicySimulationEngineProps {
  onSimulate: (data: {
    area: string
    intervention: string
    intensity: number
  }) => void
}

export function PolicySimulationEngine({ onSimulate }: PolicySimulationEngineProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [area, setArea] = useState("")
  const [intervention, setIntervention] = useState("")
  const [intensity, setIntensity] = useState([70])

  const steps = [
    { id: 1, name: "Select Area" },
    { id: 2, name: "Choose Intervention" },
    { id: 3, name: "Configure Intensity" },
    { id: 4, name: "Simulate Impact" },
    { id: 5, name: "Review Outcomes" },
  ]

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    } else if (currentStep === 4) {
      // Run simulation
      onSimulate({
        area,
        intervention,
        intensity: intensity[0],
      })
      setCurrentStep(5)
    }
  }

  const handleReset = () => {
    setCurrentStep(1)
    setArea("")
    setIntervention("")
    setIntensity([70])
  }

  const canProceed = () => {
    if (currentStep === 1) return area !== ""
    if (currentStep === 2) return intervention !== ""
    if (currentStep === 3) return true
    if (currentStep === 4) return true
    return false
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
            <p className="text-sm text-muted-foreground">
              Select the urban district where the intervention will be applied.
            </p>
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
            </div>
            <p className="text-sm text-muted-foreground">
              Ready to run impact prediction. Click below to simulate the future state of the city.
            </p>
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
          <Button onClick={handleNext} disabled={!canProceed()} className="flex-1">
            {currentStep === 4 ? (
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
