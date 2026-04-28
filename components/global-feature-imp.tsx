"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer } from "recharts"
import { BarChart2, Info } from "lucide-react"

const chartConfig = {
    importance: { label: "Importance", color: "#059669" }
}

const FEATURE_COLORS: Record<string, string> = {
    ndvi: "#059669",  // green - actionable
    albedo: "#0ea5e9",  // blue - actionable
    lat: "#6b7280",  // gray - geographic
    lon: "#6b7280",  // gray - geographic
}

const ACTIONABLE_FEATURES = ["ndvi", "albedo"]

export default function GlobalFeatureImportance() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch("http://localhost:8000/api/xai/global-feature-importance")
            .then(res => res.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return null  // silent load, no skeleton needed
    if (!data) return null

    const chartData = data.features.map((f: any) => ({
        label: f.feature === "lon"
            ? "Geo (Lon)"
            : f.feature === "lat"
                ? "Geo (Lat)"
                : f.label,
        feature: f.feature,
        importance: f.importance,
        importance_pct: f.importance_pct,
        actionable: ACTIONABLE_FEATURES.includes(f.feature)
    }))

    const actionableTotal = data.features
        .filter((f: any) => ACTIONABLE_FEATURES.includes(f.feature))
        .reduce((sum: number, f: any) => sum + f.importance_pct, 0)
        .toFixed(1)

    return (
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-bold">Model Feature Importance</h3>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    XGBoost Global
                </span>
            </div>
            <p className="text-xs text-muted-foreground mb-6">
                How much each feature influences the model's LST predictions across all 225 wards
            </p>

            {/* Actionable callout */}
            <div className="mb-5 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-start gap-2">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                    <p className="text-xs font-semibold text-primary">
                        {actionableTotal}% of model decisions are driven by actionable features
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        NDVI and Albedo can be directly influenced through policy interventions.
                        Geographic features are fixed.
                    </p>
                </div>
            </div>

            {/* Bar chart */}
            <ChartContainer config={chartConfig} className="h-[180px] w-full mb-5">
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ left: 8, right: 48, top: 4, bottom: 4 }}
                >
                    <XAxis
                        type="number"
                        tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 0.35]}
                    />
                    <YAxis
                        type="category"
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={110}
                    />
                    <ChartTooltip
                        content={
                            <ChartTooltipContent
                                formatter={(value: any) => [
                                    `${(value * 100).toFixed(1)}%`,
                                    "Feature importance"
                                ]}
                            />
                        }
                    />
                    <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry: any, index: number) => (
                            <Cell
                                key={index}
                                fill={FEATURE_COLORS[entry.feature] || "#6b7280"}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ChartContainer>

            {/* Feature breakdown table */}
            <div className="space-y-2 mb-5">
                {data.features.map((f: any) => (
                    <div key={f.feature} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ backgroundColor: FEATURE_COLORS[f.feature] || "#6b7280" }}
                            />
                            <span className="text-sm">{f.label}</span>
                            {ACTIONABLE_FEATURES.includes(f.feature) && (
                                <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">
                                    actionable
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${(f.importance / 0.35) * 100}%`,
                                        backgroundColor: FEATURE_COLORS[f.feature] || "#6b7280"
                                    }}
                                />
                            </div>
                            <span className="text-sm font-mono font-bold w-10 text-right">
                                {f.importance_pct}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Interpretation */}
            <div className="p-3 bg-muted/30 rounded-lg border border-border flex gap-2">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Geographic features (Lat/Lon) encode baseline climate zone and account for{" "}
                    {(100 - parseFloat(actionableTotal)).toFixed(1)}% of variance. These are not
                    controllable but explain why some wards are structurally hotter than others
                    regardless of vegetation cover.
                </p>
            </div>
        </Card>
    )
}