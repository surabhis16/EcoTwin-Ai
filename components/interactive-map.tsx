"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, Loader2, AlertCircle, Maximize2, Minimize2 } from "lucide-react"
import { useState, useEffect, useRef } from "react"

const getAQIColor = (aqi: number, Cesium: any) => {
  if (aqi <= 50) return Cesium.Color.fromCssColorString("#22c55e")
  if (aqi <= 100) return Cesium.Color.fromCssColorString("#facc15")
  if (aqi <= 200) return Cesium.Color.fromCssColorString("#f97316")
  return Cesium.Color.fromCssColorString("#dc2626")
}

interface InteractiveMapProps {
  viewMode: "baseline" | "simulated"
  simulationActive: boolean
  simulationData: any | null
  comparisonMode: boolean
}

interface WardBaseline {
  lst: number
  ndvi: number
  albedo?: number
  lon: number
  lat: number
  aqi?: number
}

export function InteractiveMap({ viewMode, simulationActive, simulationData, comparisonMode }: InteractiveMapProps) {
  const [activeLayer, setActiveLayer] = useState<"heat" | "green" | "pollution">("heat")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [wardsData, setWardsData] = useState<Record<number, WardBaseline>>({})
  const [wardsMetadata, setWardsMetadata] = useState<Array<{ id: number, name: string }>>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const cesiumRef = useRef<any>(null)
  const wardEntitiesRef = useRef<any[]>([])
  const initializedRef = useRef(false)

  // Fetch ward data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        const [baselinesRes, metadataRes, aqiRes] = await Promise.all([
          fetch('http://localhost:8000/api/uhi/all-ward-baselines'),
          fetch('http://localhost:8000/api/uhi/wards-metadata'),
          fetch('http://localhost:8000/api/uhi/all-ward-aqi')
        ])

        if (!baselinesRes.ok || !metadataRes.ok || !aqiRes.ok) {
          throw new Error('Failed to fetch ward data')
        }

        const baselines = await baselinesRes.json()
        const metadata = await metadataRes.json()
        const aqiData = await aqiRes.json()

        // Create AQI lookup map
        const aqiMap: Record<number, number> = {}
        if (Array.isArray(aqiData)) {
          aqiData.forEach((row: any) => {
            aqiMap[row.ward_number] = row.aqi
          })
        }

        const mergedData: Record<number, WardBaseline> = { ...baselines }
        Object.keys(mergedData).forEach((key) => {
          const wardId = parseInt(key)
          if (aqiMap[wardId] !== undefined) {
            mergedData[wardId] = {
              ...mergedData[wardId],
              aqi: aqiMap[wardId]
            }
          }
        })

        setWardsData(mergedData)
        setWardsMetadata(metadata)
        setError(null)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load map data. Check backend connection.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    if (initializedRef.current || Object.keys(wardsData).length === 0) return

    const initCesium = async () => {
      try {
        if (typeof window !== "undefined") {
          (window as any).CESIUM_BASE_URL = "/cesium"
        }

        const Cesium = await import("cesium")
        cesiumRef.current = Cesium

        const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN
        if (token) {
          Cesium.Ion.defaultAccessToken = token
        }

        if (!containerRef.current) return

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
        initializedRef.current = true

        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(77.5946, 12.9716, 60000),
        })

        setTimeout(() => {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(77.5946, 12.9716, 50000),
            duration: 2,
          })
        }, 300)

        await renderWards(viewer, Cesium, activeLayer)

      } catch (err) {
        console.error('Cesium init error:', err)
        setError(`Failed to initialize map viewer: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    initCesium()

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
      }
      viewerRef.current = null
      cesiumRef.current = null
      initializedRef.current = false
    }
  }, [wardsData, wardsMetadata])

  // Re-render when layer or simulation changes
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || (viewer.isDestroyed && viewer.isDestroyed())) return
    if (Object.keys(wardsData).length === 0) return

    renderWards(viewer, cesiumRef.current, activeLayer)
  }, [activeLayer, viewMode, simulationActive, simulationData, wardsData])

  const renderWards = async (
    viewer: any,
    Cesium: any,
    layer: "heat" | "green" | "pollution"
  ) => {
    if (!viewer) {
      console.warn('renderWards called without a viewer instance')
      return
    }

    let entitiesCollection: any
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        entitiesCollection = viewer.entities
        break
      } catch (err) {
        if (attempt === 4) {
          console.warn('Cesium viewer entities not available after retries, skipping renderWards', err)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    if (!entitiesCollection || typeof entitiesCollection.remove !== 'function') {
      console.warn('Cesium viewer entities collection is invalid, skipping renderWards', entitiesCollection)
      return
    }

    if (!Cesium) {
      Cesium = await import("cesium")
      cesiumRef.current = Cesium
    }

    wardEntitiesRef.current.forEach(entity => {
      try {
        entitiesCollection.remove(entity)
      } catch (err) {
        console.warn('Failed to remove existing ward entity:', err)
      }
    })
    wardEntitiesRef.current = []

    const getColor = (wardNum: number, data: WardBaseline) => {
      const isSimulated = simulationActive && simulationData && simulationData.wardId === wardNum

      if (layer === "pollution") {
        const aqi = data.aqi !== undefined ? Number(data.aqi) : null
        if (aqi !== null && !isNaN(aqi)) {
          return getAQIColor(aqi, Cesium)
        }
        //grey for missing aqi
        return Cesium.Color.fromCssColorString('#94a3b8')
      }

      if (layer === "heat") {
        let temp = data.lst
        if (viewMode === "simulated" && isSimulated) {
          temp = simulationData.lstAfter
        }
        if (temp >= 45) return Cesium.Color.fromCssColorString('#7f1d1d')
        if (temp >= 40) return Cesium.Color.fromCssColorString('#DC2626')
        if (temp >= 32) return Cesium.Color.fromCssColorString('#F59E0B')
        return Cesium.Color.fromCssColorString('#059669')
      }

      if (layer === "green") {
        let ndvi = data.ndvi
        if (viewMode === "simulated" && isSimulated) {
          ndvi = simulationData.ndviAfter
        }
        if (ndvi >= 0.5) return Cesium.Color.fromCssColorString('#059669')
        if (ndvi >= 0.3) return Cesium.Color.fromCssColorString('#10b981')
        if (ndvi >= 0.1) return Cesium.Color.fromCssColorString('#fbbf24')
        return Cesium.Color.fromCssColorString('#dc2626')
      }

      return Cesium.Color.fromCssColorString('#94a3b8')
    }

    const getWardName = (wardNum: number) => {
      const meta = wardsMetadata.find(w => w.id === wardNum)
      return meta ? meta.name : `Ward ${wardNum}`
    }

    Object.entries(wardsData).forEach(([wardNumStr, data]) => {
      const wardNum = parseInt(wardNumStr)

      if (layer === "pollution" && (data.aqi === undefined || data.aqi === null || Number.isNaN(Number(data.aqi)))) {
        return
      }

      const wardName = getWardName(wardNum)
      const color = getColor(wardNum, data)

      const isSimulated = simulationActive && simulationData && simulationData.wardId === wardNum

      let displayLST = data.lst
      let displayNDVI = data.ndvi
      let riskLevel = data.lst >= 45 ? "Extreme" :
        data.lst >= 40 ? "High" :
          data.lst >= 32 ? "Moderate" : "Low"

      if (viewMode === "simulated" && isSimulated) {
        displayLST = simulationData.lstAfter
        displayNDVI = simulationData.ndviAfter
        riskLevel = simulationData.risk_after || riskLevel
      }

      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(data.lon, data.lat),
        point: {
          pixelSize: isSimulated ? 12 : 8,
          color: color,
          outlineColor: isSimulated ? Cesium.Color.CYAN : Cesium.Color.WHITE,
          outlineWidth: isSimulated ? 3 : 1,
        },
        description: `
          <div style="font-family: sans-serif; padding: 12px; max-width: 320px;">
            <h3 style="color: #059669; margin: 0 0 12px 0; font-size: 16px;">
              ${wardName}
            </h3>
            
            ${isSimulated && viewMode === "simulated" ? `
              <div style="background: #ecfdf5; padding: 10px; border-radius: 6px; margin-bottom: 12px; border-left: 3px solid #059669;">
                <div style="font-size: 20px; font-weight: bold; color: #059669; text-align: center;">
                  ${simulationData.temperatureReduction?.toFixed(2)}°C Cooler
                </div>
                <div style="text-align: center; font-size: 11px; color: #666; margin-top: 4px;">
                  After ${simulationData.intervention} @ ${simulationData.intensity}%
                </div>
              </div>
            ` : ''}
            
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 6px 0; color: #666;">Ward Number:</td>
                <td style="padding: 6px 0; font-weight: 600; text-align: right;">#${wardNum}</td>
              </tr>
              
              ${layer === "pollution" && data.aqi != null ? `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 6px 0; color: #666;">AQI:</td>
                  <td style="padding: 6px 0; font-weight: 600; text-align: right;">
                    <span style="color: ${data.aqi >= 200 ? '#dc2626' :
              data.aqi >= 100 ? '#f97316' :
                data.aqi >= 50 ? '#facc15' : '#22c55e'
            };">
                      ${data.aqi.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ` : ''}
              
              ${layer === "heat" ? `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 6px 0; color: #666;">Temperature:</td>
                  <td style="padding: 6px 0; font-weight: 600; text-align: right;">${displayLST.toFixed(2)}°C</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 6px 0; color: #666;">Risk Level:</td>
                  <td style="padding: 6px 0; font-weight: 600; text-align: right;">
                    <span style="color: ${displayLST >= 45 ? '#DC2626' : displayLST >= 40 ? '#F59E0B' : '#059669'};">
                      ${riskLevel}
                    </span>
                  </td>
                </tr>
                ${data.albedo != null ? `
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 6px 0; color: #666;">Surface Albedo:</td>
                    <td style="padding: 6px 0; font-weight: 600; text-align: right;">
                      ${data.albedo.toFixed(2)}
                      <span style="font-size: 10px; font-weight: normal; color: #999;">
                        (${data.albedo < 0.15 ? 'Highly Absorbent' : 'Reflective'})
                      </span>
                    </td>
                  </tr>
                ` : ''}
              ` : ''}
              
              ${layer === "green" ? `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 6px 0; color: #666;">NDVI:</td>
                  <td style="padding: 6px 0; font-weight: 600; text-align: right;">${displayNDVI.toFixed(3)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 6px 0; color: #666;">Green Cover:</td>
                  <td style="padding: 6px 0; font-weight: 600; text-align: right;">
                    <span style="color: ${displayNDVI >= 0.6 ? '#059669' : displayNDVI >= 0.4 ? '#10b981' : '#fbbf24'};">
                      ${displayNDVI >= 0.6 ? 'Dense' : displayNDVI >= 0.4 ? 'Moderate' : displayNDVI >= 0.1 ? 'Sparse' : 'Barren'}
                    </span>
                  </td>
                </tr>
              ` : ''}
              
              <tr>
                <td style="padding: 6px 0; color: #666;">Coordinates:</td>
                <td style="padding: 6px 0; font-weight: 600; text-align: right; font-size: 11px;">${data.lat.toFixed(4)}, ${data.lon.toFixed(4)}</td>
              </tr>
            </table>
            
            ${isSimulated && viewMode === "simulated" && simulationData.co2Offset ? `
              <div style="margin-top: 12px; padding: 8px; background: #dbeafe; border-radius: 6px; font-size: 12px;">
                <strong>CO₂ Offset:</strong> ${simulationData.co2Offset} t/year
              </div>
            ` : ''}
          </div>
        `
      })

      wardEntitiesRef.current.push(entity)
    })

    viewer.scene?.requestRender?.()
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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const resetCamera = async () => {
    if (!viewerRef.current) return
    const Cesium = await import("cesium")
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(77.5946, 12.9716, 50000),
      duration: 2,
    })
  }

  const getLegendItems = () => {
    if (activeLayer === "pollution") {
      return [
        { color: '#22c55e', label: 'Good (≤50)' },
        { color: '#facc15', label: 'Moderate (51–100)' },
        { color: '#f97316', label: 'Poor (101–200)' },
        { color: '#dc2626', label: 'Severe (>200)' },
      ]
    } else if (activeLayer === "heat") {
      return [
        { color: '#7f1d1d', label: 'Extreme (≥45°C)' },
        { color: '#DC2626', label: 'High (40-45°C)' },
        { color: '#F59E0B', label: 'Moderate (32-40°C)' },
        { color: '#059669', label: 'Low (<32°C)' },
      ]
    } else if (activeLayer === "green") {
      return [
        { color: '#059669', label: 'Dense (≥0.5)' },
        { color: '#10b981', label: 'Moderate (0.3-0.5)' },
        { color: '#fbbf24', label: 'Sparse (0.1-0.3)' },
        { color: '#dc2626', label: 'Barren (<0.1)' },
      ]
    }
    return []
  }

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold mb-1">Urban Heat Island Map</h3>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading ward data...' : `Showing ${Object.keys(wardsData).length} wards across Bengaluru`}
          </p>
        </div>
        <MapPin className="h-6 w-6 text-primary" />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div
        ref={mapContainerRef}
        className={`relative rounded-lg overflow-hidden mb-4 border border-border bg-black ${isFullscreen ? 'h-screen' : 'h-80'
          }`}
      >
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-20 p-2 bg-black/70 hover:bg-black/90 rounded-lg text-white transition-colors"
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>

        {!isFullscreen && (
          <div className="absolute bottom-4 left-4 space-y-2 z-10">
            {getLegendItems().map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg"
              >
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        <div ref={containerRef} className="w-full h-full">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-white">Loading Bengaluru wards...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {!isFullscreen && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Map Layers</span>
            <Button variant="ghost" size="sm" onClick={resetCamera}>
              Reset View
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={activeLayer === "heat" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveLayer("heat")}
              disabled={loading}
              className={activeLayer === "heat" ? 'bg-orange-600 hover:bg-orange-700' : ''}
            >
              Heat Map
            </Button>
            <Button
              variant={activeLayer === "green" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveLayer("green")}
              disabled={loading}
              className={activeLayer === "green" ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              Green Cover
            </Button>
            <Button
              variant={activeLayer === "pollution" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveLayer("pollution")}
              disabled={loading}
              className={activeLayer === "pollution" ? 'bg-purple-600 hover:bg-purple-700' : ''}
            >
              Air Quality
            </Button>
          </div>

          {simulationActive && simulationData && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-xs font-semibold text-primary mb-1">
                Active Simulation: {simulationData.wardName || `Ward ${simulationData.wardId}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {simulationData.intervention} @ {simulationData.intensity}% intensity •
                {viewMode === "simulated" ? " Showing predicted impact" : " Click point for details"}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
