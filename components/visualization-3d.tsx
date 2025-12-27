"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Globe, Layers, Building2, Trees, MapPin, AlertCircle, Maximize2, Minimize2, Thermometer } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface LayerState {
  buildings: boolean
  heatIslands: boolean
  greenCover: boolean
}

interface Visualization3DProps {
  onWardSelect?: (wardData: any) => void
}

// Storing the viewer ref globally for external access
let globalViewerRef: any = null

export const updateUHIForSimulation = async (simulationData: any) => {
  if (!globalViewerRef) return

  const Cesium = await import("cesium")
  const { lon, lat } = simulationData.coordinates || { lon: 77.5946, lat: 12.9716 }

  // Create highlighted marker showing the simulated area
  const simulationMarker = globalViewerRef.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    ellipse: {
      semiMinorAxis: 2000,
      semiMajorAxis: 2000,
      material: Cesium.Color.CYAN.withAlpha(0.3),
      outline: true,
      outlineColor: Cesium.Color.CYAN,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    description: `
      <div style="font-family: sans-serif; padding: 16px; max-width: 320px;">
        <h3 style="color: #059669; margin: 0 0 12px 0; font-size: 18px; display: flex; align-items: center; gap: 8px;">
          ${simulationData.wardName || simulationData.area || 'Simulation Result'}
        </h3>
        
        <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
          <div style="font-size: 28px; font-weight: bold; color: #059669; text-align: center;">
            ${simulationData.temperatureReduction?.toFixed(2) || '0.00'}°C
          </div>
          <div style="text-align: center; font-size: 12px; color: #666; margin-top: 4px;">
            Temperature Reduction
          </div>
        </div>
        
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <tr">
            <td style="padding: 8px 0; color: #666;">Baseline LST:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${simulationData.lstBefore?.toFixed(2) || '0.00'}°C</td>
          </tr>
          <tr">
            <td style="padding: 8px 0; color: #666;">Projected LST:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #059669;">${simulationData.lstAfter?.toFixed(2) || '0.00'}°C</td>
          </tr>
          <tr">
            <td style="padding: 8px 0; color: #666;">NDVI Change:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${simulationData.ndviBefore?.toFixed(3) || '0.000'} → ${simulationData.ndviAfter?.toFixed(3) || '0.000'}</td>
          </tr>
          <tr">
            <td style="padding: 8px 0; color: #666;">Risk Status:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">
              <span style="color: ${simulationData.risk_before === 'High' || simulationData.risk_before === 'Extreme' ? '#DC2626' : '#F59E0B'};">${simulationData.risk_before || 'Unknown'}</span>
              →
              <span style="color: ${simulationData.risk_after === 'Low' ? '#059669' : '#F59E0B'};">${simulationData.risk_after || 'Unknown'}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">CO₂ Offset:</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #3B82F6;">${simulationData.co2Offset || 0} t/y</td>
          </tr>
        </table>
        
        <div style="margin-top: 12px; padding: 10px; background: #a9a9a9; border-radius: 6px; font-size: 12px;">
          <strong>Intervention:</strong> ${simulationData.intervention || 'N/A'} @ ${simulationData.intensity || 0}% intensity
        </div>
      </div>
    `
  })

  // Fly to the simulated area
  globalViewerRef.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, 8000),
    duration: 2,
  })
}

export function Visualization3D({ onWardSelect }: Visualization3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const buildingsRef = useRef<any>(null)
  const wardsDataRef = useRef<any>(null)
  const initializedRef = useRef(false)

  const [layers, setLayers] = useState<LayerState>({
    buildings: true,
    heatIslands: true,
    greenCover: false,
  })

  const [selectedWard, setSelectedWard] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState("Initializing...")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [uhiData, setUhiData] = useState<any[]>([])
  const [showUHILayer, setShowUHILayer] = useState(false)
  const [uhiLoading, setUhiLoading] = useState(false)
  const uhiEntitiesRef = useRef<any[]>([])

  const handleWardClick = async (entity: any) => {
    if (!entity || !entity.ward_number) return

    try {
      // Fetch current ward details when clicked
      const res = await fetch('http://localhost:8000/api/uhi/simulate-ward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ward_id: entity.ward_number, intensity: 0 })
      })
      const data = await res.json()

      const Cesium = await import("cesium")

      // Highlight selected ward
      const originalColor = data.lst_before >= 45
        ? Cesium.Color.fromCssColorString('#7f1d1d')
        : data.lst_before >= 40
          ? Cesium.Color.fromCssColorString('#DC2626')
          : data.lst_before >= 35
            ? Cesium.Color.fromCssColorString('#F59E0B')
            : Cesium.Color.fromCssColorString('#059669')

      entity.polygon.material = new Cesium.ColorMaterialProperty(
        Cesium.Color.CYAN.withAlpha(0.8)
      )

      // Reset after 3 seconds
      setTimeout(() => {
        entity.polygon.material = new Cesium.ColorMaterialProperty(
          originalColor.withAlpha(0.5)
        )
      }, 3000)

      const wardData = {
        ...data,
        wardId: entity.ward_number,
        name: entity.name || `Ward ${entity.ward_number}`
      }

      console.log("Ward clicked:", wardData)

      // Call parent callback if provided
      if (onWardSelect) {
        onWardSelect(wardData)
      }

      // Update selection display
      setSelectedWard(wardData.name)
    } catch (err) {
      console.error("Failed to fetch ward data:", err)
    }
  }

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const initCesium = async () => {
      try {
        setStatus("Loading Cesium library...")

        if (typeof window !== "undefined") {
          (window as any).CESIUM_BASE_URL = "/cesium"
        }

        const Cesium = await import("cesium")

        const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN
        if (token) {
          Cesium.Ion.defaultAccessToken = token
        }

        setStatus("Creating viewer...")

        if (!containerRef.current) {
          throw new Error("Container ref is null")
        }

        const viewer = new Cesium.Viewer(containerRef.current, {
          baseLayer: Cesium.ImageryLayer.fromWorldImagery({}),
          timeline: false,
          animation: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: true,
          selectionIndicator: true,
        })

        viewerRef.current = viewer
        globalViewerRef = viewer

        setStatus("Setting up camera...")

        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(77.5946, 12.9716, 80000),
        })

        setTimeout(() => {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(77.5946, 12.9716, 15000),
            duration: 3,
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-45),
              roll: 0.0,
            },
          })
        }, 500)

        setStatus("Loading buildings...")

        try {
          const buildings = await Cesium.createOsmBuildingsAsync()
          buildingsRef.current = buildings
          viewer.scene.primitives.add(buildings)
        } catch (err) {
          console.warn("Failed to load buildings:", err)
        }

        setStatus("Loading ward data...")

        try {
          await loadWardsDataOptimized(viewer, Cesium)
        } catch (err) {
          console.warn("Failed to load ward data:", err)
          setError("Failed to load ward data. Using fallback visualization.")
          createFallbackVisualization(viewer, Cesium)
        }

        viewer.selectedEntityChanged.addEventListener((entity: any) => {
          if (entity && entity.ward_number) {
            handleWardClick(entity)
          } else {
            setSelectedWard(null)
          }
        })

        setStatus("Ready")
        setLoading(false)

      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setStatus("Failed to initialize")
        setLoading(false)
      }
    }

    const loadWardsDataOptimized = async (viewer: any, Cesium: any) => {
      setStatus("Fetching all ward temperatures...")

      // Fetch all ward baselines at once 
      const baselineRes = await fetch('http://localhost:8000/api/uhi/all-ward-baselines')
      if (!baselineRes.ok) throw new Error('Failed to fetch ward baselines')

      const baselines = await baselineRes.json()
      console.log("Loaded baselines for", Object.keys(baselines).length, "wards")

      setStatus("Loading ward boundaries...")

      // Load KML with ward shapes
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("KML loading timeout (30s)")), 30000)
      )

      const loadPromise = Cesium.KmlDataSource.load("/data/bengaluru_wards.kml", {
        camera: viewer.camera,
        canvas: viewer.canvas,
        clampToGround: true,
      })

      const dataSource: any = await Promise.race([loadPromise, timeoutPromise])
      wardsDataRef.current = dataSource
      viewer.dataSources.add(dataSource)

      // setStatus("Coloring wards by temperature...")

      // 3. Apply colors based on baseline data
      for (let entity of dataSource.entities.values) {
        if (!entity.polygon) continue

        // Extract ward number from KML data
        const wardNum = entity.kml?.extendedData?.id?.value ||
          entity.kml?.extendedData?.WARD_NO?.value ||
          entity.name?.match(/\d+/)?.[0]

        if (wardNum && baselines[wardNum]) {
          const stats = baselines[wardNum]

          // Color coding by temperature
          let color: any
          if (stats.lst >= 45) {
            color = Cesium.Color.fromCssColorString("#7f1d1d") // Extreme
          } else if (stats.lst >= 40) {
            color = Cesium.Color.fromCssColorString("#DC2626") // High
          } else if (stats.lst >= 35) {
            color = Cesium.Color.fromCssColorString("#F59E0B") // Moderate
          } else {
            color = Cesium.Color.fromCssColorString("#059669") // Low
          }

          entity.polygon.material = new Cesium.ColorMaterialProperty(color.withAlpha(0.5))
          entity.polygon.outline = true
          entity.polygon.outlineColor = Cesium.Color.fromCssColorString("#0A0A0A")
          entity.polygon.outlineWidth = 2
          entity.polygon.height = 0
          entity.polygon.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND

          // Store ward metadata
          entity.addProperty('ward_number')
          entity.addProperty('lst_current')
          entity.addProperty('ndvi_current')
          entity.addProperty('lon')
          entity.addProperty('lat')

          entity.ward_number = parseInt(wardNum)
          entity.lst_current = stats.lst
          entity.ndvi_current = stats.ndvi
          entity.lon = stats.lon
          entity.lat = stats.lat

          const wardName = entity.name || `Ward ${wardNum}`
          const riskLevel = stats.lst >= 45 ? "Extreme" :
            stats.lst >= 40 ? "High" :
              stats.lst >= 35 ? "Moderate" : "Low"

          entity.description = `
            <div style="font-family: sans-serif; padding: 10px;">
              <h3 style="margin-bottom: 10px; color: #059669;">${wardName}</h3>
              <table>
                <tr><td><strong>Ward Number:</strong></td><td>#${wardNum}</td></tr>
                <tr><td><strong>Current LST:</strong></td><td>${stats.lst.toFixed(2)}°C</td></tr>
                <tr><td><strong>Risk Level:</strong></td><td style="color: ${stats.lst >= 40 ? '#DC2626' : stats.lst >= 35 ? '#F59E0B' : '#059669'};">${riskLevel}</td></tr>
                <tr><td><strong>NDVI:</strong></td><td>${stats.ndvi.toFixed(3)}</td></tr>
                <tr><td><strong>Coordinates:</strong></td><td>${stats.lat.toFixed(4)}, ${stats.lon.toFixed(4)}</td></tr>
              </table>
              <p style="margin-top: 10px; font-size: 12px; color: #666;">
                Click to view detailed ward information
              </p>
            </div>
          `
        }
      }

      console.log(`Loaded and colored ${dataSource.entities.values.length} wards`)
    }

    const createFallbackVisualization = (viewer: any, Cesium: any) => {
      const zones = [
        { name: "MG Road", lon: 77.6033, lat: 12.9762, radius: 1500, heat: 0.75 },
        { name: "Whitefield", lon: 77.7499, lat: 12.9698, radius: 3000, heat: 0.85 },
        { name: "Koramangala", lon: 77.6269, lat: 12.9279, radius: 2000, heat: 0.7 },
        { name: "Jayanagar", lon: 77.5833, lat: 12.9250, radius: 2000, heat: 0.55 },
        { name: "Indiranagar", lon: 77.6408, lat: 12.9716, radius: 1800, heat: 0.68 },
      ]

      zones.forEach((zone) => {
        const color =
          zone.heat < 0.4 ? "#059669" :
            zone.heat < 0.7 ? "#F59E0B" : "#DC2626"

        viewer.entities.add({
          name: zone.name,
          position: Cesium.Cartesian3.fromDegrees(zone.lon, zone.lat),
          ellipse: {
            semiMinorAxis: zone.radius,
            semiMajorAxis: zone.radius,
            material: Cesium.Color.fromCssColorString(color).withAlpha(0.5),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString("#0A0A0A"),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          description: `
            <div style="font-family: sans-serif; padding: 10px;">
              <h3 style="color: #059669;">${zone.name}</h3>
              <p><strong>Heat:</strong> ${(zone.heat * 100).toFixed(0)}%</p>
              <p><strong>Radius:</strong> ${zone.radius}m</p>
            </div>
          `
        })
      })
    }

    initCesium()

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
        globalViewerRef = null
      }
    }
  }, [onWardSelect])

  useEffect(() => {
    if (wardsDataRef.current) {
      wardsDataRef.current.show = layers.heatIslands
    }
  }, [layers.heatIslands])

  useEffect(() => {
    if (buildingsRef.current) {
      buildingsRef.current.show = layers.buildings
    }
  }, [layers.buildings])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleLayer = (layerName: keyof LayerState) => {
    setLayers((prev) => ({ ...prev, [layerName]: !prev[layerName] }))
  }

  const toggleFullscreen = async () => {
    if (!mapContainerRef.current) return

    try {
      if (!document.fullscreenElement) {
        await mapContainerRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }

  const resetCamera = async () => {
    if (!viewerRef.current) return
    const Cesium = await import("cesium")
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(77.5946, 12.9716, 15000),
      duration: 2,
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0,
      },
    })
  }

  const zoomToHotspots = async () => {
    if (!viewerRef.current) return
    const Cesium = await import("cesium")

    try {
      const response = await fetch('http://localhost:8000/api/uhi/bengaluru-hotspots?threshold=40')
      const result = await response.json()

      if (result.hotspots && result.hotspots.length > 0) {
        const hotspot = result.hotspots[Math.floor(Math.random() * result.hotspots.length)]

        viewerRef.current.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(hotspot.lon, hotspot.lat, 5000),
          duration: 2.5,
        })

        console.log(`Flying to hotspot: ${hotspot.lst_before?.toFixed(2)}°C`)
      } else {
        setError("No hotspots found above 40°C")
      }
    } catch (err) {
      console.error("Failed to fetch hotspots:", err)
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(77.7499, 12.9698, 8000),
        duration: 2.5,
      })
    }
  }

  const loadUHIPredictions = async () => {
    if (!viewerRef.current) return

    setUhiLoading(true)
    setStatus("Loading UHI predictions...")

    try {
      const response = await fetch('http://localhost:8000/api/uhi/all-ward-baselines')
      const result = await response.json()

      const dataArray = Object.entries(result).map(([id, val]: any) => ({
        ward_number: id,
        ...val,
        cooling: 0 // Baseline has 0 cooling
      }))

      console.log("UHI Summary:", result.summary)

      setUhiData(dataArray)
      await visualizeUHIPredictions(dataArray)
      setShowUHILayer(true)

      setStatus(`Loaded ${result.returned_points} UHI predictions`)

    } catch (err) {
      console.error("Failed to load UHI predictions:", err)
      setError("Failed to load UHI predictions. Is the backend running?")
    } finally {
      setUhiLoading(false)
    }
  }

  const visualizeUHIPredictions = async (predictions: any[]) => {
    if (!viewerRef.current) return

    const Cesium = await import("cesium")

    uhiEntitiesRef.current.forEach(entity => {
      viewerRef.current.entities.remove(entity)
    })
    uhiEntitiesRef.current = []

    predictions.forEach((pred) => {
      let color
      if (pred.cooling > 5) {
        color = Cesium.Color.fromCssColorString('#059669')
      } else if (pred.cooling > 3) {
        color = Cesium.Color.fromCssColorString('#F59E0B')
      } else if (pred.cooling > 1) {
        color = Cesium.Color.fromCssColorString('#FB923C')
      } else {
        color = Cesium.Color.fromCssColorString('#DC2626')
      }

      const lstBefore = pred.lst_before || pred.lst

      const entity = viewerRef.current.entities.add({
        position: Cesium.Cartesian3.fromDegrees(pred.lon, pred.lat),
        point: {
          pixelSize: 10,
          color: color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        description: `
        <div style="font-family: sans-serif; padding: 12px; max-width: 300px;">
          <h3 style="margin: 0 0 12px 0; color: #059669; display: flex; align-items: center; gap: 8px;">
            Green Cover Impact
          </h3>
          
          <div style="background: #f0fdf4; padding: 8px; border-radius: 6px; margin-bottom: 12px;">
            <div style="font-size: 24px; font-weight: bold; color: #059669; text-align: center;">
              ${pred.cooling.toFixed(2)}°C
            </div>
            <div style="text-align: center; font-size: 12px; color: #666;">
              Temperature Reduction
            </div>
          </div>
          
          <table style="width: 100%; font-size: 13px;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 6px 0; color: #666;">Current LST:</td>
              <td style="padding: 6px 0; font-weight: 600; text-align: right;">${lstBefore.toFixed(2)}°C</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 6px 0; color: #666;">After Greening:</td>
              <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #059669;">${pred.lst_after.toFixed(2)}°C</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 6px 0; color: #666;">NDVI:</td>
              <td style="padding: 6px 0; font-weight: 600; text-align: right;">${pred.ndvi.toFixed(3)}</td>
            </tr>
          </table>
          
          <div style="margin-top: 12px; padding: 8px; background: #fef3c7; border-radius: 6px; font-size: 12px;">
            <strong>Scenario:</strong> 20% green cover increase
          </div>
        </div>
      `
      })

      uhiEntitiesRef.current.push(entity)
    })

    console.log(`Visualized ${predictions.length} UHI predictions`)
  }

  const toggleUHILayer = () => {
    if (!showUHILayer && uhiData.length === 0) {
      loadUHIPredictions()
    } else {
      setShowUHILayer(!showUHILayer)
      uhiEntitiesRef.current.forEach(entity => {
        entity.show = !showUHILayer
      })
    }
  }

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-emerald-500/20">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Globe className="h-6 w-6 text-emerald-500" />
            3D City Twin
          </h3>
          <p className="text-sm text-muted-foreground">
            Geospatial visualization of Bengaluru's urban heat distribution
          </p>
        </div>
        {loading && (
          <Badge variant="outline" className="animate-pulse border-emerald-500/50">
            {status}
          </Badge>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-500">Note</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {selectedWard && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <p className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-500" />
            Selected: <span className="text-emerald-500">{selectedWard}</span>
          </p>
        </div>
      )}

      <div
        ref={mapContainerRef}
        className={`relative rounded-lg overflow-hidden mb-4 border border-border bg-black ${isFullscreen ? 'h-screen' : 'h-96'
          }`}
      >
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-20 p-2 bg-black/70 hover:bg-black/90 rounded-lg text-white transition-colors"
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 className="h-5 w-5" />
          ) : (
            <Maximize2 className="h-5 w-5" />
          )}
        </button>

        <div ref={containerRef} className="w-full h-full">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                <p className="text-white">{status}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {!isFullscreen && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Data Layers
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={zoomToHotspots}>
                View Hotspots
              </Button>
              <Button variant="ghost" size="sm" onClick={resetCamera}>
                Reset View
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={layers.buildings ? "default" : "outline"}
              size="sm"
              onClick={() => toggleLayer("buildings")}
              className="gap-2"
            >
              <Building2 className="h-4 w-4" />
              Buildings
            </Button>

            <Button
              variant={layers.heatIslands ? "default" : "outline"}
              size="sm"
              onClick={() => toggleLayer("heatIslands")}
              className={`gap-2 ${layers.heatIslands ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
            >
              <Globe className="h-4 w-4" />
              Heat Map
            </Button>

          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mt-2">
              Click any ward to view detailed metrics and simulate interventions
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}