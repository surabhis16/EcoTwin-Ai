"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, MessageSquare, TrendingDown, TrendingUp } from "lucide-react"
import { useState } from "react"

const sentimentZones = [
  {
    id: 1,
    name: "Koramangala",
    lat: 12.9352,
    lng: 77.6245,
    sentiment: "positive",
    score: 85,
    trend: "up",
    trendValue: "+5%",
    dominantTheme: "Improved public transport",
    feedbackCount: 342,
    exampleFeedback: "New metro connectivity has reduced my commute time by 30 minutes.",
    stressRisk: "low",
  },
  {
    id: 2,
    name: "Whitefield",
    lat: 12.9698,
    lng: 77.7499,
    sentiment: "negative",
    score: 42,
    trend: "down",
    trendValue: "-12%",
    dominantTheme: "Traffic congestion",
    feedbackCount: 567,
    exampleFeedback: "Daily gridlock makes it impossible to reach work on time. Need better road planning.",
    stressRisk: "high",
  },
  {
    id: 3,
    name: "Indiranagar",
    lat: 12.9716,
    lng: 77.6412,
    sentiment: "positive",
    score: 78,
    trend: "up",
    trendValue: "+2%",
    dominantTheme: "Green space expansion",
    feedbackCount: 289,
    exampleFeedback: "The new parks have made our neighborhood so much more livable and pleasant.",
    stressRisk: "low",
  },
  {
    id: 4,
    name: "Electronic City",
    lat: 12.8456,
    lng: 77.6603,
    sentiment: "neutral",
    score: 65,
    trend: "up",
    trendValue: "+8%",
    dominantTheme: "Air quality concerns",
    feedbackCount: 423,
    exampleFeedback: "Some improvements with tree planting, but industrial emissions still a concern.",
    stressRisk: "medium",
  },
  {
    id: 5,
    name: "Jayanagar",
    lat: 12.925,
    lng: 77.5937,
    sentiment: "negative",
    score: 38,
    trend: "down",
    trendValue: "-8%",
    dominantTheme: "Waste management issues",
    feedbackCount: 612,
    exampleFeedback: "Garbage collection is irregular and causing health issues in our area.",
    stressRisk: "high",
  },
  {
    id: 6,
    name: "HSR Layout",
    lat: 12.9121,
    lng: 77.6446,
    sentiment: "neutral",
    score: 58,
    trend: "down",
    trendValue: "-3%",
    dominantTheme: "Water supply reliability",
    feedbackCount: 398,
    exampleFeedback: "Water cuts are becoming more frequent, need better infrastructure.",
    stressRisk: "medium",
  },
]

type FilterType = "all" | "positive" | "neutral" | "negative" | "stress"

export function SentimentAnalysis() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const [selectedZone, setSelectedZone] = useState<(typeof sentimentZones)[0] | null>(null)

  const filteredZones = sentimentZones.filter((zone) => {
    if (activeFilter === "all") return true
    if (activeFilter === "stress") return zone.stressRisk === "high"
    return zone.sentiment === activeFilter
  })

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "text-emerald-500"
      case "negative":
        return "text-red-500"
      default:
        return "text-yellow-500"
    }
  }

  const getSentimentBgColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-emerald-500"
      case "negative":
        return "bg-red-500"
      default:
        return "bg-yellow-500"
    }
  }

  const getStressRiskColor = (risk: string) => {
    switch (risk) {
      case "high":
        return "text-red-500"
      case "medium":
        return "text-yellow-500"
      default:
        return "text-emerald-500"
    }
  }

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold mb-1">Urban Intelligence Layer</h3>
          <p className="text-sm text-muted-foreground">Geo-tagged citizen sentiment heatmap</p>
        </div>
        <MessageSquare className="h-6 w-6 text-accent" />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          variant={activeFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter("all")}
        >
          All Zones
        </Button>
        <Button
          variant={activeFilter === "positive" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter("positive")}
          className={activeFilter === "positive" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
        >
          Positive
        </Button>
        <Button
          variant={activeFilter === "neutral" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter("neutral")}
          className={activeFilter === "neutral" ? "bg-yellow-600 hover:bg-yellow-700" : ""}
        >
          Neutral
        </Button>
        <Button
          variant={activeFilter === "negative" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter("negative")}
          className={activeFilter === "negative" ? "bg-red-600 hover:bg-red-700" : ""}
        >
          Negative
        </Button>
        <Button
          variant={activeFilter === "stress" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFilter("stress")}
          className="gap-1"
        >
          <AlertTriangle className="h-3 w-3" />
          Stress Risk Zones
        </Button>
      </div>

      <div className="space-y-3 max-h-400px overflow-y-auto">
        {filteredZones.map((zone) => (
          <div
            key={zone.id}
            className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedZone?.id === zone.id
              ? "bg-accent/20 border-accent"
              : "bg-muted/30 border-transparent hover:bg-muted/50 hover:border-accent/50"
              }`}
            onClick={() => setSelectedZone(zone)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{zone.name}</span>
                {zone.stressRisk === "high" && <AlertTriangle className="h-4 w-4 text-red-500" />}
              </div>
              <span
                className={`text-sm font-medium flex items-center gap-1 ${zone.trend === "up" ? "text-emerald-500" : "text-red-500"
                  }`}
              >
                {zone.trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {zone.trendValue}
              </span>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={getSentimentBgColor(zone.sentiment)} style={{ width: `${zone.score}%` }} />
              </div>
              <span className={`text-sm font-bold min-w-12 text-right ${getSentimentColor(zone.sentiment)}`}>
                {zone.score}/100
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              {zone.feedbackCount} feedback submissions • {zone.dominantTheme}
            </p>

            {selectedZone?.id === zone.id && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <p className="text-xs font-semibold text-accent mb-1">Dominant Theme:</p>
                  <p className="text-sm">{zone.dominantTheme}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-accent mb-1">Example Feedback:</p>
                  <p className="text-sm italic text-muted-foreground">"{zone.exampleFeedback}"</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-accent mb-1">Stress Risk Level:</p>
                    <p className={`text-sm font-bold uppercase ${getStressRiskColor(zone.stressRisk)}`}>
                      {zone.stressRisk}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-accent mb-1">30-Day Trend:</p>
                    <p className={`text-sm font-bold ${zone.trend === "up" ? "text-emerald-500" : "text-red-500"}`}>
                      {zone.trendValue}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 rounded-lg bg-accent/10 border border-accent/20">
        <p className="text-sm text-center">
          <span className="font-semibold text-accent">2,847</span> geo-tagged feedback submissions •{" "}
          <span className="font-semibold text-red-500">
            {sentimentZones.filter((z) => z.stressRisk === "high").length}
          </span>{" "}
          high-stress zones identified
        </p>
      </div>
    </Card>
  )
}
