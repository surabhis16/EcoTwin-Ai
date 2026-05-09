"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Loader2,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const API_BASE_URL = "http://localhost:8000"

interface EquityWard {
  ward_id: number
  ward_name: string
  assembly_constituency?: string
  risk_level: string
  marginalized_share: number
  female_share: number
  demographic_vulnerability: number
  exposure_score: number
  equity_priority_score: number
  heat_rank: number
  equity_rank: number
  rank_gap: number
  flags: string[]
}

interface ConstituencySummary {
  assembly_constituency: string
  ward_count: number
  avg_equity_priority_score: number
  avg_marginalized_share: number
  high_or_extreme_heat_wards: number
}

// ward_metrics removed — no longer in /audit response
interface EquityAudit {
  summary: {
    total_wards: number
    flagged_wards: number
    avg_marginalized_share: number
    avg_female_share: number
    method: string
  }
  priority_wards: EquityWard[]
  under_prioritized_wards: EquityWard[]
  constituency_summary: ConstituencySummary[]
  material_fairness: {
    bias_risk: string
    equitable_option_share: number
    expensive_cooling_option_share: number
    median_price_inr_per_m3: number
    guidance: string
  }
}

type AuditLens = "priority" | "under-priority" | "demographics" | "materials"
type SortMode = "equity" | "rank-gap" | "marginalized" | "gender-gap" | "heat"

function formatPct(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return "N/A"
  return `${(value * 100).toFixed(1)}%`
}

function riskTone(risk: string) {
  if (risk === "High") return "border-yellow-500/40 text-yellow-600"
  if (risk === "Moderate") return "border-blue-500/40 text-blue-600"
  if (risk === "Low") return "border-emerald-500/40 text-emerald-600"
  return "border-red-500/40 text-red-600"
}

function scoreWidth(value: number) {
  return `${Math.max(4, Math.min(100, value * 100))}%`
}

const PAGE_SIZE = 30

export default function EquityAuditPanel() {
  const [audit, setAudit] = useState<EquityAudit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [auditLens, setAuditLens] = useState<AuditLens>("priority")
  const [constituency, setConstituency] = useState("all")
  const [sortMode, setSortMode] = useState<SortMode>("equity")
  const [selectedWardId, setSelectedWardId] = useState<number | null>(null)
  const [wardMetrics, setWardMetrics] = useState<EquityWard[]>([])
  const [wardPage, setWardPage] = useState(1)
  const [wardTotal, setWardTotal] = useState(0)
  const [wardsLoading, setWardsLoading] = useState(false)

  // initial load — summary only, no ward_metrics
  useEffect(() => {
    const fetchAudit = async () => {
      try {
        setLoading(true)
        const response = await fetch(`${API_BASE_URL}/api/equity/audit`)
        if (!response.ok) throw new Error("Failed to fetch equity audit")
        setAudit(await response.json())
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch")
      } finally {
        setLoading(false)
      }
    }
    fetchAudit()
  }, [])

  // reset to page 1 whenever filters or sort change
  useEffect(() => {
    setWardPage(1)
  }, [constituency, sortMode, auditLens])

  // ward list - fetches when lens/constituency/sort/page changes
  useEffect(() => {
    if (auditLens === "materials") return

    const fetchWards = async () => {
      setWardsLoading(true)
      try {
        const params = new URLSearchParams({
          page: wardPage.toString(),
          page_size: PAGE_SIZE.toString(),
          sort_by: sortMode,
          ...(constituency !== "all" && { constituency }),
        })
        const res = await fetch(`${API_BASE_URL}/api/equity/audit/wards?${params}`)
        const data = await res.json()
        setWardMetrics(data.wards)
        setWardTotal(data.total)
      } catch (err) {
        console.error("Failed to fetch ward metrics:", err)
      } finally {
        setWardsLoading(false)
      }
    }
    fetchWards()
  }, [auditLens, constituency, sortMode, wardPage])

  const materialRiskTone = useMemo(() => {
    if (!audit) return "border-muted text-muted-foreground"
    if (audit.material_fairness.bias_risk === "High") return "border-red-500/40 text-red-600"
    if (audit.material_fairness.bias_risk === "Moderate") return "border-yellow-500/40 text-yellow-600"
    return "border-emerald-500/40 text-emerald-600"
  }, [audit])

  // derive constituency list from wardMetrics (populated after first ward fetch)
  const constituencies = useMemo(() => {
    return Array.from(
      new Set(wardMetrics.map((w) => w.assembly_constituency || "Unknown"))
    ).sort()
  }, [wardMetrics])

  // selectedWard uses wardMetrics
  const selectedWard = useMemo(() => {
    const defaultWard = wardMetrics[0] ?? audit?.priority_wards[0] ?? null
    if (!selectedWardId) return defaultWard
    return wardMetrics.find((w) => w.ward_id === selectedWardId) ?? defaultWard
  }, [audit, wardMetrics, selectedWardId])

  const totalPages = Math.ceil(wardTotal / PAGE_SIZE)

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Equity & Bias Audit
          </h3>
          <p className="text-sm text-muted-foreground">
            Explore ward-level fairness across demographics, heat exposure, constituency, and material affordability.
          </p>
        </div>
        {audit && (
          <Badge variant="outline" className={materialRiskTone}>
            Material bias: {audit.material_fairness.bias_risk}
          </Badge>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && audit && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border bg-background/60 p-3">
              <Users className="h-4 w-4 text-primary mb-2" />
              <p className="text-xs uppercase font-bold text-muted-foreground">Audited Wards</p>
              <p className="text-2xl font-black">{audit.summary.total_wards}</p>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mb-2" />
              <p className="text-xs uppercase font-bold text-muted-foreground">Flagged Wards</p>
              <p className="text-2xl font-black">{audit.summary.flagged_wards}</p>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <ShieldCheck className="h-4 w-4 text-emerald-500 mb-2" />
              <p className="text-xs uppercase font-bold text-muted-foreground">Avg SC/ST Share</p>
              <p className="text-2xl font-black">{formatPct(audit.summary.avg_marginalized_share)}</p>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <Landmark className="h-4 w-4 text-blue-500 mb-2" />
              <p className="text-xs uppercase font-bold text-muted-foreground">Fair Materials</p>
              <p className="text-2xl font-black">{formatPct(audit.material_fairness.equitable_option_share)}</p>
            </div>
          </div>

          <div className="rounded-lg border bg-background/50 p-4">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h4 className="font-bold">Interactive Audit Controls</h4>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Audit Lens</p>
                <Select value={auditLens} onValueChange={(value) => setAuditLens(value as AuditLens)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Equity Priority</SelectItem>
                    <SelectItem value="under-priority">Under-Priority Watch</SelectItem>
                    <SelectItem value="demographics">Demographic Vulnerability</SelectItem>
                    <SelectItem value="materials">Material Bias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Assembly Constituency</p>
                <Select value={constituency} onValueChange={setConstituency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all">All constituencies</SelectItem>
                    {constituencies.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Sort Wards By</p>
                <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equity">Equity rank</SelectItem>
                    <SelectItem value="rank-gap">Under-priority gap</SelectItem>
                    <SelectItem value="marginalized">SC/ST share</SelectItem>
                    <SelectItem value="gender-gap">Gender imbalance</SelectItem>
                    <SelectItem value="heat">Heat rank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <div className="rounded-lg border bg-background/50 p-4 lg:col-span-7">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold">
                  {auditLens === "materials" ? "Material Bias Signals" : "Ward Audit Explorer"}
                </h4>
                {auditLens !== "materials" && (
                  <span className="text-xs text-muted-foreground">
                    {wardTotal} wards total
                  </span>
                )}
              </div>

              {auditLens === "materials" ? (
                <div className="space-y-3">
                  <div className="rounded-md border bg-card/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">Affordable high-cooling options</span>
                      <span className="text-sm font-bold text-emerald-600">
                        {formatPct(audit.material_fairness.equitable_option_share)}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: scoreWidth(audit.material_fairness.equitable_option_share) }}
                      />
                    </div>
                  </div>
                  <div className="rounded-md border bg-card/50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">Expensive cooling skew</span>
                      <span className="text-sm font-bold text-yellow-600">
                        {formatPct(audit.material_fairness.expensive_cooling_option_share)}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-yellow-500"
                        style={{ width: scoreWidth(audit.material_fairness.expensive_cooling_option_share) }}
                      />
                    </div>
                  </div>
                  <div className="rounded-md border bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-300">
                    Median price baseline: Rs {audit.material_fairness.median_price_inr_per_m3.toLocaleString()}/m³.{" "}
                    {audit.material_fairness.guidance}
                  </div>
                </div>
              ) : (
                <>
                  {wardsLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                      {wardMetrics.map((ward) => (
                        <button
                          key={ward.ward_id}
                          type="button"
                          onClick={() => setSelectedWardId(ward.ward_id)}
                          className={`w-full rounded-md border p-3 text-left transition-colors hover:border-primary/60 ${selectedWard?.ward_id === ward.ward_id
                            ? "border-primary bg-primary/10"
                            : "bg-card/50"
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{ward.ward_name}</p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {ward.assembly_constituency || "Unknown constituency"}
                              </p>
                            </div>
                            <Badge variant="outline" className={riskTone(ward.risk_level)}>
                              {ward.risk_level}
                            </Badge>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                            <span>Equity #{ward.equity_rank}</span>
                            <span>Heat #{ward.heat_rank}</span>
                            <span>SC/ST {formatPct(ward.marginalized_share)}</span>
                            <span>Gap +{ward.rank_gap}</span>
                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: scoreWidth(ward.equity_priority_score) }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  <div className="flex items-center justify-between pt-3 mt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      Page {wardPage} of {totalPages || 1}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={wardPage === 1 || wardsLoading}
                        onClick={() => setWardPage((p) => p - 1)}
                      >
                        <ChevronLeft className="h-3 w-3 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={wardPage >= totalPages || wardsLoading}
                        onClick={() => setWardPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border bg-background/50 p-4 lg:col-span-5">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h4 className="font-bold">Selected Ward Analysis</h4>
              </div>

              {selectedWard ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black">{selectedWard.ward_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedWard.assembly_constituency || "Unknown constituency"}
                      </p>
                    </div>
                    <Badge variant="outline" className={riskTone(selectedWard.risk_level)}>
                      {selectedWard.risk_level}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border bg-card/50 p-3">
                      <p className="text-xs uppercase font-bold text-muted-foreground">Equity Score</p>
                      <p className="text-2xl font-black">
                        {(selectedWard.equity_priority_score * 100).toFixed(0)}
                      </p>
                    </div>
                    <div className="rounded-md border bg-card/50 p-3">
                      <p className="text-xs uppercase font-bold text-muted-foreground">Rank Gap</p>
                      <p className="text-2xl font-black text-primary">+{selectedWard.rank_gap}</p>
                    </div>
                    <div className="rounded-md border bg-card/50 p-3">
                      <p className="text-xs uppercase font-bold text-muted-foreground">SC/ST Share</p>
                      <p className="text-2xl font-black">{formatPct(selectedWard.marginalized_share)}</p>
                    </div>
                    <div className="rounded-md border bg-card/50 p-3">
                      <p className="text-xs uppercase font-bold text-muted-foreground">Female Share</p>
                      <p className="text-2xl font-black">{formatPct(selectedWard.female_share)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>Exposure</span>
                        <span>{(selectedWard.exposure_score * 100).toFixed(0)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{ width: scoreWidth(selectedWard.exposure_score) }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>Demographic vulnerability</span>
                        <span>{(selectedWard.demographic_vulnerability * 100).toFixed(0)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: scoreWidth(selectedWard.demographic_vulnerability) }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border bg-card/50 p-3">
                    <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Audit Finding</p>
                    <p className="text-sm">
                      {selectedWard.flags[0] ||
                        "No major bias flag. Continue monitoring before lowering priority."}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a ward to inspect detailed audit signals.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-background/50 p-4">
            <h4 className="font-bold mb-3">Assembly Constituency Exposure</h4>
            <div className="grid gap-2 md:grid-cols-3">
              {audit.constituency_summary.slice(0, 6).map((item) => (
                <div key={item.assembly_constituency} className="rounded-md border bg-card/50 p-3">
                  <p className="text-sm font-semibold truncate">{item.assembly_constituency}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.high_or_extreme_heat_wards} hot wards</span>
                    <span>SC/ST {formatPct(item.avg_marginalized_share)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{audit.summary.method}</p>
        </div>
      )}
    </Card>
  )
}