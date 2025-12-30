import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Sparkles, ChevronRight, Check, Loader2, Package } from "lucide-react"
import { useState, useEffect } from "react"

interface PolicySimulationEngineProps {
  onSimulate: (data: any) => void
}

export default function PolicySimulationEngine({ onSimulate }: PolicySimulationEngineProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [wardId, setWardId] = useState("")
  const [intervention, setIntervention] = useState("")
  const [intensity, setIntensity] = useState([50])
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [wards, setWards] = useState<{ id: number; name: string }[]>([])
  const [areaData, setAreaData] = useState<any>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [simulationResult, setSimulationResult] = useState<any>(null)

  const steps = [
    { id: 1, name: "Select Ward" },
    { id: 2, name: "Choose Intervention" },
    { id: 3, name: "Select Materials" },
    { id: 4, name: "Configure Intensity" },
    { id: 5, name: "Review & Simulate" },
    { id: 6, name: "Results" },
  ]

  useEffect(() => {
    fetch('http://localhost:8000/api/uhi/wards-metadata')
      .then(res => res.json())
      .then(setWards)
      .catch(console.error)
  }, [])

  const fetchWardBaseline = async (wId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/uhi/ward-baseline/${wId}`)
      const data = await response.json()
      setAreaData(data)
    } catch (err) {
      console.error("Failed to fetch ward baseline:", err)
    }
  }

  const fetchMaterialRecommendations = async () => {
    if (!wardId || !intervention) return

    setMaterialsLoading(true)
    try {
      const wardName = wards.find(w => w.id === parseInt(wardId))?.name || ""

      // determine application based on intervention type
      const application = intervention === "green" ? "Wall" :
        intervention === "cooling" ? "Roof" :
          intervention === "materials" ? "Wall" : "Wall"

      const response = await fetch('http://localhost:8000/api/materials/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ward_name: wardName,
          application: application,
          preferences: {
            cost: 0.25,
            health: 0.25,
            cooling: 0.25,
            sustainability: 0.25
          },
          top_n: 5
        })
      })

      const data = await response.json()
      setMaterials(data)

      // auto-select top material
      if (data.length > 0) {
        setSelectedMaterial(data[0])
      }
    } catch (err) {
      console.error("Failed to fetch materials:", err)
      setMaterials([])
    } finally {
      setMaterialsLoading(false)
    }
  }

  const handleNext = async () => {
    if (currentStep === 1 && wardId && !areaData) {
      await fetchWardBaseline(wardId)
      setCurrentStep(2)
    } else if (currentStep === 2) {
      await fetchMaterialRecommendations()
      setCurrentStep(3)
    } else if (currentStep < 5) {
      setCurrentStep(currentStep + 1)
    } else if (currentStep === 5) {
      await runSimulation()
    }
  }

  const runSimulation = async () => {
    setLoading(true)

    try {
      // calc ndvi increase based on intervention and intensity
      let ndviIncrease = 0
      if (intervention === "green") {
        ndviIncrease = (intensity[0] / 100) * 0.3
      } else if (intervention === "cooling") {
        ndviIncrease = (intensity[0] / 100) * 0.2
      } else if (intervention === "materials") {
        ndviIncrease = (intensity[0] / 100) * 0.1
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

      // calculate environmental impact
      const areaSqKm = areaData?.area_sqkm || 1
      const areaHectares = areaSqKm * 100
      const ndviGain = prediction.ndvi_after - prediction.ndvi_before

      // base CO2 from green cover
      const baseCO2 = Math.max(0, ndviGain) * areaHectares * 25

      // add material CO2 benefit if material selected
      const materialCO2 = selectedMaterial ?
        (selectedMaterial.predicted_impact.co2Reduction * areaHectares * 0.01) : 0

      const totalCO2 = baseCO2 + materialCO2

      // add material cooling benefit
      const materialCooling = selectedMaterial ?
        Math.abs(selectedMaterial.predicted_impact.tempChange) : 0

      const totalCooling = prediction.cooling_effect + (materialCooling * 0.5) // 50% of material's cooling

      const treeEquivalent = Math.round(totalCO2 / 0.022)
      const carEquivalent = Math.round(totalCO2 / 4.6)

      const result = {
        wardId,
        wardName: wards.find(w => w.id === parseInt(wardId))?.name,
        intervention,
        intensity: intensity[0],
        temperatureReduction: totalCooling,
        baseCooling: prediction.cooling_effect,
        materialCooling: materialCooling * 0.5,
        area_sqkm: areaSqKm,
        lstBefore: prediction.lst_before,
        lstAfter: prediction.lst_after - (materialCooling * 0.5),
        ndviBefore: prediction.ndvi_before,
        ndviAfter: prediction.ndvi_after,
        riskReduction: prediction.risk_reduction,
        co2Offset: parseFloat(totalCO2.toFixed(0)),
        baseCO2: parseFloat(baseCO2.toFixed(0)),
        materialCO2: parseFloat(materialCO2.toFixed(0)),
        treeEquivalent: treeEquivalent,
        carEquivalent: carEquivalent,
        selectedMaterial: selectedMaterial ? {
          name: selectedMaterial.material_name,
          type: selectedMaterial.usage_type,
          coolingIndex: selectedMaterial.cooling_index,
          tempReduction: materialCooling * 0.5,
          co2Reduction: materialCO2
        } : null
      }

      setSimulationResult(result)
      onSimulate(result)
      setCurrentStep(6)
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
    setSelectedMaterial(null)
    setMaterials([])
    setAreaData(null)
    setSimulationResult(null)
  }

  const canProceed = () => {
    if (currentStep === 1) return wardId !== ""
    if (currentStep === 2) return intervention !== ""
    if (currentStep === 3) return selectedMaterial !== null
    return true
  }

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold mb-1">Policy Simulation Engine</h3>
          <p className="text-sm text-muted-foreground">Model intervention impacts with material selection</p>
        </div>
        <Sparkles className="h-6 w-6 text-primary" />
      </div>

      {/* Step indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between overflow-x-auto pb-2">
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
                  className={`text-xs mt-2 text-center w-16 ${currentStep >= step.id ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}
                >
                  {step.name}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-8 h-0.5 mb-6 mx-1 ${currentStep > step.id ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="min-h-64 mb-6">
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ward">Select Ward</Label>
              <Select value={wardId} onValueChange={(val) => { setWardId(val); fetchWardBaseline(val) }}>
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
                <p>Temperature: {areaData.lst_before?.toFixed(2)}°C</p>
                <p>NDVI: {areaData.ndvi_before?.toFixed(3)}</p>
                <p>Risk: {areaData.risk_before}</p>
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
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <Label>Recommended Materials</Label>
              {materialsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>

            {materials.length === 0 && !materialsLoading && (
              <p className="text-sm text-muted-foreground">No materials available</p>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {materials.map((material, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedMaterial(material)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedMaterial?.material_name === material.material_name
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                    }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{material.material_name}</p>
                      <p className="text-xs text-muted-foreground">{material.usage_type}</p>
                    </div>
                    <div className="text-xs font-mono bg-primary/20 px-2 py-1 rounded">
                      Score: {(material.final_score * 100).toFixed(0)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Cooling</p>
                      <p className="font-bold">{Math.abs(material.predicted_impact.tempChange)}°C</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">CO₂</p>
                      <p className="font-bold">{material.predicted_impact.co2Reduction.toFixed(0)} kg</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cost</p>
                      <p className="font-bold">₹{(material.price_inr_per_m3 / 1000).toFixed(1)}k/m³</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 4 && (
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
              NDVI gain: +{((intensity[0] / 100) * (intervention === "green" ? 0.3 : intervention === "cooling" ? 0.2 : 0.1)).toFixed(2)}
            </p>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Ward</span>
                <span className="font-semibold">{wards.find(w => w.id === parseInt(wardId))?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Area</span>
                <span className="font-semibold">{areaData?.area_sqkm?.toFixed(2)} km²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Intervention</span>
                <span className="font-semibold">{intervention}</span>
              </div>
              {selectedMaterial && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Selected Material
                  </p>
                  <p className="text-sm">{selectedMaterial.material_name}</p>
                  <p className="text-xs text-muted-foreground">
                    +{Math.abs(selectedMaterial.predicted_impact.tempChange * 0.5).toFixed(2)}°C additional cooling
                  </p>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Intensity</span>
                <span className="font-semibold">{intensity[0]}%</span>
              </div>
            </div>
          </div>
        )}

        {currentStep === 6 && simulationResult && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center p-6 bg-primary/5 rounded-2xl border border-primary/20">
              <Check className="h-10 w-10 text-primary mb-2" />
              <p className="font-bold text-primary">Simulation Complete</p>
              <p className="text-xs text-muted-foreground mb-4">{simulationResult.wardName}</p>

              <div className="grid grid-cols-2 gap-3 w-full mb-4">
                <div className="bg-background/50 p-3 rounded-lg border">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Total Cooling</p>
                  <p className="text-2xl font-black text-emerald-500">
                    {simulationResult.temperatureReduction.toFixed(2)}°C
                  </p>
                  {simulationResult.selectedMaterial && (
                    <p className="text-[9px] text-muted-foreground mt-1">
                      Base: {simulationResult.baseCooling.toFixed(2)}°C + Material: {simulationResult.materialCooling.toFixed(2)}°C
                    </p>
                  )}
                </div>

                <div className="bg-background/50 p-3 rounded-lg border">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Carbon Offset</p>
                  <p className="text-2xl font-black text-blue-500">
                    {simulationResult.co2Offset} t/y
                  </p>
                  {simulationResult.selectedMaterial && (
                    <p className="text-[9px] text-muted-foreground mt-1">
                      +{simulationResult.materialCO2.toFixed(0)} from materials
                    </p>
                  )}
                </div>
              </div>

              {simulationResult.selectedMaterial && (
                <div className="w-full p-3 bg-primary/10 rounded-lg border border-primary/20 mb-4">
                  <p className="text-xs font-bold mb-1 flex items-center gap-2">
                    <Package className="h-3 w-3" />
                    Material Impact
                  </p>
                  <p className="text-xs">{simulationResult.selectedMaterial.name}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Extra Cooling</p>
                      <p className="font-bold">+{simulationResult.selectedMaterial.tempReduction.toFixed(2)}°C</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Extra CO₂</p>
                      <p className="font-bold">+{simulationResult.selectedMaterial.co2Reduction.toFixed(0)} t/y</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="bg-background/50 p-3 rounded-lg border">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Equivalent</p>
                  <p className="text-lg font-black text-emerald-500">{simulationResult.treeEquivalent.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Mature Trees</p>
                </div>
                <div className="bg-background/50 p-3 rounded-lg border">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Impact</p>
                  <p className="text-lg font-black text-blue-500">{simulationResult.carEquivalent.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Cars off road</p>
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
      {currentStep < 6 && (
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
                Running...
              </>
            ) : currentStep === 5 ? (
              <>
                Run Simulation
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