from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import Any, Dict, Iterable, List, Optional


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize(value: float, low: float, high: float, invert: bool = False) -> float:
    if high <= low:
        return 0.0
    score = (value - low) / (high - low)
    score = max(0.0, min(1.0, score))
    return 1.0 - score if invert else score


def _risk_level(lst: float) -> str:
    if lst < 35:
        return "Low"
    if lst < 40:
        return "Moderate"
    if lst < 45:
        return "High"
    return "Extreme"


def _percentile(values: List[float], percentile: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    index = (len(values) - 1) * percentile
    lower = int(index)
    upper = min(lower + 1, len(values) - 1)
    weight = index - lower
    return values[lower] * (1 - weight) + values[upper] * weight


@dataclass
class WardEquityMetrics:
    ward_id: int
    ward_name: str
    population: int
    assembly_constituency: Optional[str]
    baseline_lst: float
    baseline_ndvi: float
    aqi: Optional[float]
    marginalized_share: float
    female_share: float
    gender_balance_gap: float
    demographic_vulnerability: float
    exposure_score: float
    equity_priority_score: float
    heat_rank: int = 0
    equity_rank: int = 0


def build_ward_equity_metrics(rows: Iterable[Any]) -> List[Dict[str, Any]]:
    raw_rows = [dict(row._mapping) if hasattr(row, "_mapping") else dict(row) for row in rows]
    if not raw_rows:
        return []

    lst_values = [_safe_float(row.get("baseline_lst")) for row in raw_rows]
    ndvi_values = [_safe_float(row.get("baseline_ndvi")) for row in raw_rows]
    aqi_values = [_safe_float(row.get("aqi")) for row in raw_rows if row.get("aqi") is not None]
    marginalized_values = []

    for row in raw_rows:
        population = max(_safe_int(row.get("population")), 1)
        marginalized = _safe_int(row.get("sc_population")) + _safe_int(row.get("st_population"))
        marginalized_values.append(marginalized / population)

    lst_low, lst_high = min(lst_values), max(lst_values)
    ndvi_low, ndvi_high = min(ndvi_values), max(ndvi_values)
    aqi_low = min(aqi_values) if aqi_values else 0.0
    aqi_high = max(aqi_values) if aqi_values else 1.0

    metrics: List[WardEquityMetrics] = []
    for row in raw_rows:
        population = max(_safe_int(row.get("population")), 1)
        male_population = _safe_int(row.get("male_population"))
        female_population = _safe_int(row.get("female_population"))
        known_gender_population = max(male_population + female_population, 1)

        sc_st_population = _safe_int(row.get("sc_population")) + _safe_int(row.get("st_population"))
        marginalized_share = sc_st_population / population
        female_share = female_population / known_gender_population
        gender_balance_gap = abs(0.5 - female_share) * 2

        baseline_lst = _safe_float(row.get("baseline_lst"))
        baseline_ndvi = _safe_float(row.get("baseline_ndvi"))
        aqi = row.get("aqi")
        aqi_score = _normalize(_safe_float(aqi), aqi_low, aqi_high) if aqi is not None else 0.0

        heat_score = _normalize(baseline_lst, lst_low, lst_high)
        low_green_score = _normalize(baseline_ndvi, ndvi_low, ndvi_high, invert=True)
        demographic_vulnerability = min(
            1.0,
            (marginalized_share * 0.75) + (gender_balance_gap * 0.25),
        )
        exposure_score = (
            heat_score * 0.62
            + low_green_score * 0.23
            + aqi_score * 0.15
        )
        equity_priority_score = (
            exposure_score * 0.68
            + demographic_vulnerability * 0.32
        )

        metrics.append(
            WardEquityMetrics(
                ward_id=_safe_int(row.get("ward_number")),
                ward_name=str(row.get("ward_name_en") or ""),
                population=population,
                assembly_constituency=row.get("assembly_constituency"),
                baseline_lst=baseline_lst,
                baseline_ndvi=baseline_ndvi,
                aqi=_safe_float(aqi) if aqi is not None else None,
                marginalized_share=marginalized_share,
                female_share=female_share,
                gender_balance_gap=gender_balance_gap,
                demographic_vulnerability=demographic_vulnerability,
                exposure_score=exposure_score,
                equity_priority_score=equity_priority_score,
            )
        )

    heat_order = sorted(metrics, key=lambda item: item.baseline_lst, reverse=True)
    equity_order = sorted(metrics, key=lambda item: item.equity_priority_score, reverse=True)
    for index, item in enumerate(heat_order, start=1):
        item.heat_rank = index
    for index, item in enumerate(equity_order, start=1):
        item.equity_rank = index

    marginalized_cutoff = _percentile(marginalized_values, 0.75)
    vulnerability_cutoff = _percentile([item.demographic_vulnerability for item in metrics], 0.75)

    audited = []
    for item in metrics:
        rank_gap = item.heat_rank - item.equity_rank
        high_heat = item.baseline_lst >= 40
        high_vulnerability = item.demographic_vulnerability >= vulnerability_cutoff
        high_marginalized_share = item.marginalized_share >= marginalized_cutoff

        flags = []
        if high_heat and high_marginalized_share and rank_gap >= 15:
            flags.append("Heat-only ranking may under-prioritize a marginalized high-risk ward")
        if high_vulnerability and item.equity_rank <= 25 and item.heat_rank > 40:
            flags.append("Demographic vulnerability raises this ward into the top equity priority band")
        if item.female_share < 0.47 or item.female_share > 0.53:
            flags.append("Gender distribution differs from parity; review outreach assumptions")

        audited.append(
            {
                "ward_id": item.ward_id,
                "ward_name": item.ward_name,
                "population": item.population,
                "assembly_constituency": item.assembly_constituency,
                "baseline_lst": round(item.baseline_lst, 2),
                "baseline_ndvi": round(item.baseline_ndvi, 3),
                "aqi": round(item.aqi, 2) if item.aqi is not None else None,
                "risk_level": _risk_level(item.baseline_lst),
                "marginalized_share": round(item.marginalized_share, 4),
                "female_share": round(item.female_share, 4),
                "gender_balance_gap": round(item.gender_balance_gap, 4),
                "demographic_vulnerability": round(item.demographic_vulnerability, 4),
                "exposure_score": round(item.exposure_score, 4),
                "equity_priority_score": round(item.equity_priority_score, 4),
                "heat_rank": item.heat_rank,
                "equity_rank": item.equity_rank,
                "rank_gap": rank_gap,
                "flags": flags,
            }
        )

    return audited


def summarize_equity_audit(ward_metrics: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not ward_metrics:
        return {
            "summary": {},
            "priority_wards": [],
            "under_prioritized_wards": [],
            "constituency_summary": [],
        }

    priority_wards = sorted(
        ward_metrics,
        key=lambda row: row["equity_priority_score"],
        reverse=True,
    )[:10]
    under_prioritized = [
        row for row in sorted(ward_metrics, key=lambda row: row["rank_gap"], reverse=True)
        if row["rank_gap"] >= 15 and row["risk_level"] in {"High", "Extreme"}
    ][:10]

    by_constituency: Dict[str, List[Dict[str, Any]]] = {}
    for row in ward_metrics:
        key = row.get("assembly_constituency") or "Unknown"
        by_constituency.setdefault(key, []).append(row)

    constituency_summary = []
    for constituency, rows in by_constituency.items():
        constituency_summary.append(
            {
                "assembly_constituency": constituency,
                "ward_count": len(rows),
                "avg_equity_priority_score": round(
                    sum(row["equity_priority_score"] for row in rows) / len(rows),
                    4,
                ),
                "avg_marginalized_share": round(
                    sum(row["marginalized_share"] for row in rows) / len(rows),
                    4,
                ),
                "high_or_extreme_heat_wards": sum(
                    1 for row in rows if row["risk_level"] in {"High", "Extreme"}
                ),
            }
        )
    constituency_summary.sort(key=lambda row: row["avg_equity_priority_score"], reverse=True)

    flagged_count = sum(1 for row in ward_metrics if row["flags"])
    return {
        "summary": {
            "total_wards": len(ward_metrics),
            "flagged_wards": flagged_count,
            "avg_marginalized_share": round(
                sum(row["marginalized_share"] for row in ward_metrics) / len(ward_metrics),
                4,
            ),
            "avg_female_share": round(
                sum(row["female_share"] for row in ward_metrics) / len(ward_metrics),
                4,
            ),
            "method": (
                "Equity priority combines heat exposure, low green cover, AQI, "
                "SC/ST population share, and gender balance. Rank gap compares "
                "heat-only priority against equity-adjusted priority."
            ),
        },
        "priority_wards": priority_wards,
        "under_prioritized_wards": under_prioritized,
        "constituency_summary": constituency_summary[:12],
    }


def audit_material_recommendations(materials: Iterable[Any]) -> Dict[str, Any]:
    rows = [dict(row._mapping) if hasattr(row, "_mapping") else dict(row) for row in materials]
    if not rows:
        return {
            "material_count": 0,
            "bias_risk": "Unknown",
            "message": "No material records available for fairness audit.",
        }

    prices = [_safe_float(row.get("price_inr_per_m3")) for row in rows if row.get("price_inr_per_m3") is not None]
    cooling = [_safe_float(row.get("cooling_index")) for row in rows if row.get("cooling_index") is not None]
    carbon = [_safe_float(row.get("embodied_carbon")) for row in rows if row.get("embodied_carbon") is not None]

    median_price = median(prices) if prices else 0.0
    median_cooling = median(cooling) if cooling else 0.0
    median_carbon = median(carbon) if carbon else 0.0

    equitable_options = [
        row for row in rows
        if _safe_float(row.get("price_inr_per_m3")) <= median_price
        and _safe_float(row.get("cooling_index")) >= median_cooling
    ]
    expensive_cooling_options = [
        row for row in rows
        if _safe_float(row.get("price_inr_per_m3")) > median_price * 1.25
        and _safe_float(row.get("cooling_index")) >= median_cooling
    ]

    equitable_share = len(equitable_options) / len(rows)
    expensive_share = len(expensive_cooling_options) / len(rows)
    if equitable_share < 0.15 and expensive_share > 0.35:
        bias_risk = "High"
    elif equitable_share < 0.25:
        bias_risk = "Moderate"
    else:
        bias_risk = "Low"

    return {
        "material_count": len(rows),
        "bias_risk": bias_risk,
        "median_price_inr_per_m3": round(median_price, 2),
        "median_cooling_index": round(median_cooling, 4),
        "median_embodied_carbon": round(median_carbon, 4),
        "equitable_option_share": round(equitable_share, 4),
        "expensive_cooling_option_share": round(expensive_share, 4),
        "guidance": (
            "For high-vulnerability wards, prefer materials that stay at or below "
            "median price while meeting or exceeding median cooling performance."
        ),
    }
