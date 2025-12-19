"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Globe, Layers, Building2, Trees, MapPin, AlertCircle, Maximize2, Minimize2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface LayerState {
  buildings: boolean
  heatIslands: boolean
  greenCover: boolean
}

export function Visualization3D() {
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
          fullscreenButton: false, // Disable default fullscreen
          infoBox: true,
          selectionIndicator: true,
        })

        viewerRef.current = viewer

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
        } catch { }

        setStatus("Loading ward data...")

        try {
          await loadWardsData(viewer, Cesium)
        } catch {
          createFallbackVisualization(viewer, Cesium)
        }

        viewer.selectedEntityChanged.addEventListener((entity: any) => {
          if (entity && entity.name) {
            setSelectedWard(entity.name)
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

    const loadWardsData = async (viewer: any, Cesium: any) => {
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

      dataSource.entities.values.forEach((entity: any, index: number) => {
        if (!entity.polygon) return

        const heatIntensity = 0.2 + (Math.sin(index * 0.5) * 0.5 + 0.5) * 0.7

        let color: any
        if (heatIntensity < 0.4) {
          color = Cesium.Color.fromCssColorString("#059669")
        } else if (heatIntensity < 0.7) {
          color = Cesium.Color.fromCssColorString("#F59E0B")
        } else {
          color = Cesium.Color.fromCssColorString("#DC2626")
        }

        entity.polygon.material = new Cesium.ColorMaterialProperty(color.withAlpha(0.6))
        entity.polygon.outline = true
        entity.polygon.outlineColor = Cesium.Color.fromCssColorString("#0A0A0A")
        entity.polygon.outlineWidth = 2
        entity.polygon.height = 0
        entity.polygon.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND

        const wardName = entity.name || `Ward ${index + 1}`
        const riskLevel =
          heatIntensity > 0.7 ? "High Risk" :
            heatIntensity > 0.4 ? "Moderate" : "Low Risk"

        entity.description = `
          <div style="font-family: sans-serif; padding: 10px;">
            <h3 style="margin-bottom: 10px; color: #059669;">${wardName}</h3>
            <table>
              <tr><td><strong>Heat Intensity:</strong></td><td>${(heatIntensity * 100).toFixed(1)}%</td></tr>
              <tr><td><strong>Risk Level:</strong></td><td>${riskLevel}</td></tr>
              <tr><td><strong>Temperature:</strong></td><td>${(28 + heatIntensity * 8).toFixed(1)}°C</td></tr>
            </table>
          </div>
        `
      })
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

      setError("Using sample visualization. Upload bengaluru_wards.kml for full data.")
    }

    initCesium()

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
      }
    }
  }, [])

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

  // Handle fullscreen change events
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

    const hotspots = [
      { lon: 77.7499, lat: 12.9698 },
      { lon: 77.6648, lat: 12.8456 },
      { lon: 77.6969, lat: 12.9591 },
    ]

    const random = hotspots[Math.floor(Math.random() * hotspots.length)]

    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(random.lon, random.lat, 8000),
      duration: 2.5,
    })
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
        {/* Fullscreen button overlay */}
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

      {/* Controls - hidden in fullscreen */}
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

          <div className="grid grid-cols-3 gap-2">
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
            <Button
              variant={layers.greenCover ? "default" : "outline"}
              size="sm"
              onClick={() => toggleLayer("greenCover")}
              className="gap-2"
              disabled
            >
              <Trees className="h-4 w-4" />
              Green Cover
            </Button>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Heat Intensity Scale:</p>
            </div>
            <div className="space-y-2">
              <div className="h-2 rounded-full bg-linear-to-r from-emerald-500 via-amber-500 to-red-600"></div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Low</span>
                <span>Moderate</span>
                <span>High</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Click any zone to view detailed heat island metrics
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}