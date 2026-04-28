import { Card } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, Cell, ReferenceLine, ResponsiveContainer } from "recharts"
import { Loader2, FlaskConical, Info } from "lucide-react"

interface XAIExplanationPanelProps {
    xaiData: any
    xaiLoading: boolean
}

const chartConfig = {
    cooling: { label: "Cooling Effect", color: "#059669" },
    warming: { label: "Warming Effect", color: "#DC2626" },
}

export default function XAIExplanationPanel({ xaiData, xaiLoading }: XAIExplanationPanelProps) {
    if (xaiLoading) {
        return (
            <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20 mt-4">
                <div className="flex items-center gap-2 mb-4">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-bold">XAI Explanation</h3>
                </div>
                <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Computing SHAP values...</span>
                </div>
            </Card>
        )
    }

    if (!xaiData) return null

    const delta = xaiData.explanation?.delta || []

    // build chart data from SHAP delta
    const chartData = delta.map((d: any) => ({
        label: d.feature === "lon"
            ? "Geo (Lon)"
            : d.feature === "lat"
                ? "Geo (Lat)"
                : d.label,
        value: parseFloat(d.shap_delta.toFixed(3)),
        magnitude: d.magnitude,
        direction: d.direction,
        fill: d.direction === "cooling" ? "#059669" : "#DC2626"
    }))

    const primaryDriver = xaiData.explanation?.primary_driver
    const summary = xaiData.explanation?.summary

    // pct contribution of primary driver
    const totalMagnitude = delta.reduce((sum: number, d: any) => sum + d.magnitude, 0)
    const primaryPct = primaryDriver
        ? Math.round((primaryDriver.magnitude / totalMagnitude) * 100)
        : 0

    return (
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20 mt-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-bold">XAI Explanation</h3>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    SHAP Analysis
                </span>
            </div>
            <p className="text-xs text-muted-foreground mb-6">
                Why did the model predict this cooling outcome?
            </p>

            {/* Primary driver callout */}
            {primaryDriver && (
                <div className="mb-5 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">
                        Primary Driver
                    </p>
                    <p className="text-sm font-semibold">
                        {primaryDriver.label}
                        <span className="ml-2 text-emerald-500 font-mono">
                            {primaryPct}% of cooling effect
                        </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        SHAP contribution: {primaryDriver.shap_delta.toFixed(3)}°C
                    </p>
                </div>
            )}

            {/* SHAP waterfall bar chart */}
            <div className="mb-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">
                    Feature Contribution to Temperature Change
                </p>
                <ChartContainer config={chartConfig} className="h-[180px] w-full">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
                    >
                        <XAxis
                            type="number"
                            tickFormatter={(v) => `${v.toFixed(1)}°C`}
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            type="category"
                            dataKey="label"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            width={100}
                        />
                        <ReferenceLine x={0} stroke="#666" strokeWidth={1} />
                        <ChartTooltip
                            content={
                                <ChartTooltipContent
                                    formatter={(value: any) => [
                                        `${parseFloat(value).toFixed(3)}°C`,
                                        "SHAP contribution"
                                    ]}
                                />
                            }
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry: any, index: number) => (
                                <Cell key={index} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ChartContainer>

                {/* Legend */}
                <div className="flex gap-4 mt-2 justify-center">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-emerald-600" />
                        <span className="text-xs text-muted-foreground">Cooling contribution</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-red-600" />
                        <span className="text-xs text-muted-foreground">Warming contribution</span>
                    </div>
                </div>
            </div>

            {/* Model internals */}
            <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-muted/50 p-3 rounded-lg text-center">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Base Value</p>
                    <p className="text-sm font-mono font-bold">{xaiData.base_value?.toFixed(2)}°C</p>
                    <p className="text-[9px] text-muted-foreground">Avg city LST</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg text-center">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Raw Delta</p>
                    <p className="text-sm font-mono font-bold text-emerald-500">
                        {xaiData.raw_delta?.toFixed(3)}°C
                    </p>
                    <p className="text-[9px] text-muted-foreground">Surface temp</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg text-center">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Air Temp</p>
                    <p className="text-sm font-mono font-bold text-blue-500">
                        {(xaiData.raw_delta * 0.33)?.toFixed(3)}°C
                    </p>
                    <p className="text-[9px] text-muted-foreground">×0.33 scaled</p>
                </div>
            </div>

            {/* Summary */}
            {summary && (
                <div className="p-3 bg-muted/30 rounded-lg border border-border flex gap-2">
                    <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>
                </div>
            )}
        </Card>
    )
}