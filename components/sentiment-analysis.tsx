"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, MessageSquare, Loader2, RefreshCw, MapPin, Globe, ExternalLink, Calendar } from "lucide-react"
import { useState, useEffect } from "react"

export function SentimentAnalysis() {
  const [activeFilter, setActiveFilter] = useState<"all" | "infrastructure" | "water" | "urban_planning" | "stress">("all")
  const [activeTab, setActiveTab] = useState<"ward" | "citywide">("ward")
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [collectionProgress, setCollectionProgress] = useState<string>("")
  const [statistics, setStatistics] = useState<any>(null)
  const [hotspots, setHotspots] = useState<any[]>([])
  const [citywidePost, setCitywidePost] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, hotspotsRes, citywideRes] = await Promise.all([
        fetch('http://localhost:8000/api/sentiment/statistics'),
        fetch('http://localhost:8000/api/sentiment/hotspots?risk_level=high&limit=20'),
        fetch('http://localhost:8000/api/sentiment/city-wide-sentiment?limit=20')
      ])

      if (statsRes.ok) {
        const stats = await statsRes.json()
        setStatistics(stats)
      }

      if (hotspotsRes.ok) {
        const spots = await hotspotsRes.json()
        setHotspots(spots.hotspots || [])
      }

      if (citywideRes.ok) {
        const citywide = await citywideRes.json()
        setCitywidePost(citywide.posts || [])
      }
    } catch (err) {
      console.error('Failed to fetch sentiment data:', err)
    } finally {
      setLoading(false)
    }
  }

  const triggerDataCollection = async () => {
    setCollecting(true)
    setCollectionProgress("Initiating collection...")

    try {
      const res = await fetch('http://localhost:8000/api/sentiment/collect-reddit?max_posts=100', {
        method: 'POST'
      })

      if (res.ok) {
        setCollectionProgress("Collecting posts from Reddit and news sources...")

        let attempts = 0
        const pollInterval = setInterval(async () => {
          attempts++

          if (attempts > 30) {
            clearInterval(pollInterval)
            setCollecting(false)
            setCollectionProgress("")
            fetchData()
            return
          }

          setCollectionProgress(`Processing... (${attempts * 2}s)`)
        }, 2000)

        setTimeout(() => {
          clearInterval(pollInterval)
          setCollectionProgress("Finalizing analysis...")

          setTimeout(() => {
            fetchData()
            setCollecting(false)
            setCollectionProgress("")
          }, 2000)
        }, 10000)
      }
    } catch (err) {
      console.error('Collection failed:', err)
      setCollecting(false)
      setCollectionProgress("")
    }
  }

  const getSentimentColor = (score: number) => {
    if (score > 0.2) return "text-emerald-500"
    if (score < -0.2) return "text-red-500"
    return "text-yellow-500"
  }

  const getSentimentBgColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "bg-emerald-500"
      case "negative": return "bg-red-500"
      default: return "bg-yellow-500"
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  }

  const filteredHotspots = activeFilter === "all"
    ? hotspots
    : activeFilter === "stress"
      ? hotspots
      : hotspots.filter(h => h.policy_category === activeFilter)

  if (loading) {
    return (
      <Card className="p-6 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-accent" />
            Urban Intelligence Layer
          </h3>
          <p className="text-sm text-muted-foreground">
            Real-time citizen sentiment from Reddit & News
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={triggerDataCollection}
          disabled={collecting}
        >
          {collecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {collectionProgress || "Collecting..."}
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Update Data
            </>
          )}
        </Button>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Ward Posts</p>
            <p className="text-xl font-bold">{statistics.total_feedback}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">City-Wide</p>
            <p className="text-xl font-bold text-blue-500">{statistics.citywide_feedback}</p>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10">
            <p className="text-xs text-muted-foreground mb-1">Negative</p>
            <p className="text-xl font-bold text-red-500">
              {statistics.distribution.negative}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10">
            <p className="text-xs text-muted-foreground mb-1">High Stress</p>
            <p className="text-xl font-bold text-amber-500 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              {statistics.high_stress_zones}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <Button
          variant={activeTab === "ward" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("ward")}
          className="gap-2"
        >
          <MapPin className="h-4 w-4" />
          Ward-Specific ({hotspots.length})
        </Button>
        <Button
          variant={activeTab === "citywide" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("citywide")}
          className="gap-2"
        >
          <Globe className="h-4 w-4" />
          City-Wide ({citywidePost.length})
        </Button>
      </div>

      {/* Ward-Specific Tab */}
      {activeTab === "ward" && (
        <>
          {/* Category Filters */}
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              variant={activeFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter("all")}
            >
              All Issues
            </Button>
            <Button
              variant={activeFilter === "infrastructure" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter("infrastructure")}
            >
              Infrastructure
            </Button>
            <Button
              variant={activeFilter === "water" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter("water")}
            >
              Water
            </Button>
            <Button
              variant={activeFilter === "urban_planning" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter("urban_planning")}
            >
              Urban Planning
            </Button>
            <Button
              variant={activeFilter === "stress" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter("stress")}
              className="gap-1"
            >
              <AlertTriangle className="h-3 w-3" />
              High Stress
            </Button>
          </div>

          {/* Hotspots Grid - Full Width Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-125 overflow-y-auto">
            {filteredHotspots.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No ward-specific sentiment data</p>
              </div>
            ) : (
              filteredHotspots.map((spot, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border bg-muted/30 border-transparent hover:bg-muted/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold text-sm line-clamp-1">{spot.location}</span>
                    </div>
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500"
                        style={{ width: `${Math.abs(spot.sentiment_score) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-red-500">
                      {(spot.sentiment_score * 100).toFixed(0)}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {spot.example_feedback}
                  </p>

                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {spot.policy_category}
                      </Badge>
                      {spot.created_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(spot.created_at)}
                        </span>
                      )}
                    </div>
                    {spot.source_url && (
                      <a
                        href={spot.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 shrink-0"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* City-Wide Tab */}
      {activeTab === "citywide" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-125 overflow-y-auto">
          {citywidePost.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No city-wide posts yet</p>
            </div>
          ) : (
            citywidePost.map((post, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border bg-muted/30 border-transparent"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="font-semibold text-sm line-clamp-1">{post.location}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs shrink-0 ${post.sentiment === "positive"
                      ? "border-emerald-500/50 text-emerald-500"
                      : post.sentiment === "negative"
                        ? "border-red-500/50 text-red-500"
                        : "border-yellow-500/50 text-yellow-500"
                      }`}
                  >
                    {post.sentiment}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={getSentimentBgColor(post.sentiment)}
                      style={{ width: `${Math.abs(post.sentiment_score) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold ${getSentimentColor(post.sentiment_score)}`}>
                    {(post.sentiment_score * 100).toFixed(0)}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {post.text_preview}...
                </p>

                <div className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {post.platform}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {post.policy_category}
                    </Badge>
                  </div>
                  {post.source_url && (
                    <a
                      href={post.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-center text-muted-foreground">
          {statistics && (
            <>
              Analyzing{" "}
              <span className="font-semibold text-foreground">
                {statistics.total_feedback + statistics.citywide_feedback}
              </span>{" "}
              total posts •{" "}
              <span className="font-semibold text-foreground">
                {statistics.wards_covered}
              </span>{" "}
              wards covered •{" "}
              <span className="font-semibold text-red-500">
                {statistics.high_stress_zones}
              </span>{" "}
              high-stress zones
            </>
          )}
        </p>
      </div>
    </Card>
  )
}