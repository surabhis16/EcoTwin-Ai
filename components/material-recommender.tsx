import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Layers, MapPin, TrendingDown, TrendingUp, Leaf, Loader2, RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"

interface MaterialImpact {
  tempChange: number
  co2Reduction: number
  sustainabilityChange: number
}

interface Material {
  material_name: string
  usage_type: string
  price_inr_per_m3: number
  final_score: number
  cooling_index: number
  voc_rating: number
  transport_adjusted_carbon: number
  predicted_impact: MaterialImpact
}

interface MaterialRecommenderProps {
  selectedZone?: string
  onMaterialApplied?: (material: Material) => void
}

const API_BASE_URL = "http://localhost:8000"

export default function MaterialRecommender({ selectedZone, onMaterialApplied }: MaterialRecommenderProps) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appliedMaterial, setAppliedMaterial] = useState<Material | null>(null)
  const [showImpact, setShowImpact] = useState(false)
  const [application, setApplication] = useState("Wall")
  const [availableApplications, setAvailableApplications] = useState<string[]>([])

  // fetch available applications on mount
  useEffect(() => {
    fetchApplications()
  }, [])

  // fetch materials when zone changes
  useEffect(() => {
    if (selectedZone) {
      fetchMaterials()
    }
  }, [selectedZone, application])

  const fetchApplications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/materials/applications`)
      const data = await response.json()
      setAvailableApplications(data.applications || ["Wall", "Roof", "Flooring"])
    } catch (err) {
      console.error("Failed to fetch applications:", err)
      setAvailableApplications(["Wall", "Roof", "Flooring"])
    }
  }

  const fetchMaterials = async () => {
    if (!selectedZone) return

    setLoading(true)
    setError(null)

    try {
      // extract ward name from selectedZone (format: "Ward Name (X.XX km²)")
      const wardName = selectedZone.split(" (")[0].trim()

      const response = await fetch(`${API_BASE_URL}/api/materials/recommend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ward_name: wardName,
          application: application,
          preferences: {
            cost: 0.25,
            health: 0.25,
            cooling: 0.25,
            sustainability: 0.25,
          },
          top_n: 5,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data = await response.json()
      setMaterials(data)
    } catch (err) {
      console.error("Error fetching materials:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch materials")
    } finally {
      setLoading(false)
    }
  }

  const handleApplyMaterial = (material: Material) => {
    setAppliedMaterial(material)
    setShowImpact(true)

    // notify parent component that material was applied
    if (onMaterialApplied) {
      // create simulation data structure for visualization
      const materialSimulationData = {
        wardName: selectedZone,
        area: selectedZone,
        intervention: "material application",
        intensity: 100,
        temperatureReduction: Math.abs(material.predicted_impact.tempChange),
        co2Offset: material.predicted_impact.co2Reduction,
        selectedMaterial: {
          name: material.material_name,
          type: material.usage_type,
          coolingIndex: material.cooling_index,
          tempReduction: Math.abs(material.predicted_impact.tempChange),
          co2Reduction: material.predicted_impact.co2Reduction
        },
        // add default coordinates (will be overridden if available)
        coordinates: { lon: 77.5946, lat: 12.9716 }
      }

      onMaterialApplied(materialSimulationData as any)

    }

    setTimeout(() => setShowImpact(false), 5000)
  }

  const getEcoRating = (score: number): string => {
    if (score >= 0.9) return "A+"
    if (score >= 0.8) return "A"
    if (score >= 0.7) return "B+"
    if (score >= 0.6) return "B"
    return "C"
  }

  const getCostRating = (price: number): string => {
    // adjusted thresholds for Indian construction materials
    if (price < 3000) return "₹"      // low cost
    if (price < 8000) return "₹₹"     // medium cost
    return "₹₹₹"                       // high cost
  }

  const formatHealth = (voc: number): string => {
    // VOC Rating: Lower is better (0 = best, 100 = worst)
    // Health score: Higher is better (100 = best, 0 = worst)
    const healthScore = Math.max(0, 100 - voc)
    return `${healthScore.toFixed(0)}%`
  }

  const formatCooling = (coolingIndex: number): string => {
    // C.I - normalized, convert to 0-10 display scale
    return (coolingIndex * 10).toFixed(1)
  }

  const formatCarbon = (carbon: number): string => {
    // Transport adjusted carbon in kg CO2/kg
    return carbon.toFixed(2)
  }

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold mb-1">Material Recommender</h3>
          <p className="text-sm text-muted-foreground">
            {selectedZone ? `Analyzing: ${selectedZone}` : "Select a zone to get recommendations"}
          </p>
        </div>
        <Layers className="h-6 w-6 text-primary" />
      </div>

      {/* Application Selector */}
      {selectedZone && (
        <div className="mb-4 flex gap-2">
          {["Wall", "Roof", "Flooring"].map((app) => (
            <Button
              key={app}
              size="sm"
              variant={application === app ? "default" : "outline"}
              onClick={() => setApplication(app)}
            >
              {app}
            </Button>
          ))}
          {selectedZone && (
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchMaterials}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      )}

      {/* Impact Banner */}
      {showImpact && appliedMaterial && (
        <div className="mb-4 p-4 rounded-lg bg-primary/10 border-2 border-primary/50 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <p className="text-sm font-semibold text-primary">Digital Twin Updated</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Applied <span className="font-semibold text-foreground">{appliedMaterial.material_name}</span> to{" "}
            {selectedZone || "selected zone"}
          </p>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded bg-background/50">
              <div className="flex items-center gap-1 mb-1">
                <TrendingDown className="h-3 w-3 text-blue-500" />
                <p className="text-xs text-muted-foreground">Temp</p>
              </div>
              <p className="text-sm font-bold text-blue-500">
                {Math.abs(appliedMaterial.predicted_impact.tempChange).toFixed(2)}°C
              </p>
            </div>

            <div className="p-2 rounded bg-background/50">
              <div className="flex items-center gap-1 mb-1">
                <Leaf className="h-3 w-3 text-emerald-500" />
                <p className="text-xs text-muted-foreground">CO₂</p>
              </div>
              <p className="text-sm font-bold text-emerald-500">
                -{appliedMaterial.predicted_impact.co2Reduction.toFixed(0)}kg/yr
              </p>
            </div>

            <div className="p-2 rounded bg-background/50">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3 text-primary" />
                <p className="text-xs text-muted-foreground">Score</p>
              </div>
              <p className="text-sm font-bold text-primary">
                +{appliedMaterial.predicted_impact.sustainabilityChange.toFixed(0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/50">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Materials List */}
      {!loading && materials.length > 0 && (
        <div className="space-y-3">
          {materials.map((material, index) => (
            <div
              key={index}
              className="p-4 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/50 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-lg mb-1">{material.material_name}</h4>
                  <p className="text-xs text-muted-foreground">{material.usage_type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 rounded bg-primary/20 text-primary text-xs font-bold">
                    {getEcoRating(material.final_score)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                <div className="p-2 rounded bg-background/50">
                  <p className="text-muted-foreground mb-1">Cooling</p>
                  <p className="font-bold">{formatCooling(material.cooling_index)}</p>
                </div>
                <div className="p-2 rounded bg-background/50">
                  <p className="text-muted-foreground mb-1">Health</p>
                  <p className="font-bold">{formatHealth(material.voc_rating)}</p>
                </div>
                <div className="p-2 rounded bg-background/50">
                  <p className="text-muted-foreground mb-1">Carbon</p>
                  <p className="font-bold">{formatCarbon(material.transport_adjusted_carbon)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Score: <span className="text-foreground font-semibold">{(material.final_score * 100).toFixed(0)}/100</span>
                  </span>
                  <span className="text-muted-foreground">
                    Cost: <span className="text-foreground font-semibold">
                      {material.price_inr_per_m3 > 0
                        ? `₹${(material.price_inr_per_m3).toLocaleString()}/m³`
                        : "N/A"}
                    </span>
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleApplyMaterial(material)}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Apply to Zone
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !selectedZone && (
        <div className="text-center py-12">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Select a zone on the map to get AI-powered material recommendations</p>
        </div>
      )}
    </Card>
  )
}