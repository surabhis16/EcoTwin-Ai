"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  Landmark,
  Loader2,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
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

interface EquityAudit {
  summary: {
    total_wards: number
    flagged_wards: number
    avg_marginalized_share: number
    avg_female_share: number
    method: string
  }
  ward_metrics: EquityWard[]
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

function genderGap(ward: EquityWard) {
  return Math.abs(0.5 - ward.female_share) * 2
}

export default function EquityAuditPanel() {
  const [audit, setAudit] = useState<EquityAudit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [auditLens, setAuditLens] = useState<AuditLens>("priority")
  const [constituency, setConstituency] = useState("all")
  const [sortMode, setSortMode] = useState<SortMode>("equity")
  const [selectedWardId, setSelectedWardId] = useState<number | null>(null)

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        setLoading(true)
        const response = await fetch(`${API_BASE_URL}/api/equity/audit`)
        if (!response.ok) throw new Error("Failed to fetch equity audit")
        setAudit(await response.json())
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch equity audit")
      } finally {
        setLoading(false)
      }
    }

    fetchAudit()
  }, [])

  const materialRiskTone = useMemo(() => {
    if (!audit) return "border-muted text-muted-foreground"
    if (audit.material_fairness.bias_risk === "High") return "border-red-500/40 text-red-600"
    if (audit.material_fairness.bias_risk === "Moderate") return "border-yellow-500/40 text-yellow-600"
    return "border-emerald-500/40 text-emerald-600"
  }, [audit])

  const constituencies = useMemo(() => {
    if (!audit) return []
    return Array.from(
      new Set(audit.ward_metrics.map((ward) => ward.assembly_constituency || "Unknown"))
    ).sort()
  }, [audit])

  const filteredWards = useMemo(() => {
    if (!audit) return []

    let wards = audit.ward_metrics.filter((ward) => {
      const matchesConstituency = constituency === "all" || (ward.assembly_constituency || "Unknown") === constituency
      if (!matchesConstituency) return false

      if (auditLens === "under-priority") return ward.rank_gap >= 10 || ward.flags.length > 0
      if (auditLens === "demographics") {
        return ward.marginalized_share >= audit.summary.avg_marginalized_share || genderGap(ward) >= 0.06
      }
      return true
    })

    wards = [...wards].sort((a, b) => {
      if (sortMode === "rank-gap") return b.rank_gap - a.rank_gap
      if (sortMode === "marginalized") return b.marginalized_share - a.marginalized_share
      if (sortMode === "gender-gap") return genderGap(b) - genderGap(a)
      if (sortMode === "heat") return a.heat_rank - b.heat_rank
      return a.equity_rank - b.equity_rank
    })

    return wards
  }, [audit, auditLens, constituency, sortMode])

  const selectedWard = useMemo(() => {
    if (!audit) return null
    const defaultWard = filteredWards[0] || audit.priority_wards[0] || null
    if (!selectedWardId) return defaultWard
    return audit.ward_metrics.find((ward) => ward.ward_id === selectedWardId) || defaultWard
  }, [audit, filteredWards, selectedWardId])

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
                <span className="text-xs text-muted-foreground">{filteredWards.length} wards in view</span>
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
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: scoreWidth(audit.material_fairness.equitable_option_share) }} />
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
                      <div className="h-full rounded-full bg-yellow-500" style={{ width: scoreWidth(audit.material_fairness.expensive_cooling_option_share) }} />
                    </div>
                  </div>
                  <div className="rounded-md border bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-300">
                    Median price baseline: Rs {audit.material_fairness.median_price_inr_per_m3.toLocaleString()}/m3. {audit.material_fairness.guidance}
                  </div>
                </div>
              ) : (
                <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {filteredWards.slice(0, 30).map((ward) => (
                    <button
                      key={ward.ward_id}
                      type="button"
                      onClick={() => setSelectedWardId(ward.ward_id)}
                      className={`w-full rounded-md border p-3 text-left transition-colors hover:border-primary/60 ${selectedWard?.ward_id === ward.ward_id ? "border-primary bg-primary/10" : "bg-card/50"}`}
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
                        <div className="h-full rounded-full bg-primary" style={{ width: scoreWidth(ward.equity_priority_score) }} />
                      </div>
                    </button>
                  ))}
                </div>
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
                      <p className="text-sm text-muted-foreground">{selectedWard.assembly_constituency || "Unknown constituency"}</p>
                    </div>
                    <Badge variant="outline" className={riskTone(selectedWard.risk_level)}>
                      {selectedWard.risk_level}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border bg-card/50 p-3">
                      <p className="text-xs uppercase font-bold text-muted-foreground">Equity Score</p>
                      <p className="text-2xl font-black">{(selectedWard.equity_priority_score * 100).toFixed(0)}</p>
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
                        <div className="h-full rounded-full bg-red-500" style={{ width: scoreWidth(selectedWard.exposure_score) }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>Demographic vulnerability</span>
                        <span>{(selectedWard.demographic_vulnerability * 100).toFixed(0)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: scoreWidth(selectedWard.demographic_vulnerability) }} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border bg-card/50 p-3">
                    <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Audit Finding</p>
                    <p className="text-sm">
                      {selectedWard.flags[0] || "No major bias flag. Continue monitoring before lowering priority."}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a ward to inspect detailed audit signals.</p>
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
