import os

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from sqlalchemy import create_engine, text

from app.services.equity_audit import (
    audit_material_recommendations,
    build_ward_equity_metrics,
    summarize_equity_audit,
)

load_dotenv()

router = APIRouter(prefix="/api/equity", tags=["equity"])
engine = create_engine(os.getenv("DATABASE_URL"), pool_pre_ping=True, pool_recycle=300)


WARD_EQUITY_QUERY = text(
    """
    SELECT
        ward_number,
        ward_name_en,
        population,
        baseline_lst,
        baseline_ndvi,
        aqi,
        male_population,
        female_population,
        sc_population,
        st_population,
        assembly_constituency
    FROM bengaluru_wards
    WHERE baseline_lst IS NOT NULL
      AND baseline_ndvi IS NOT NULL
    """
)


@router.get("/audit")
def get_equity_audit():
    try:
        with engine.connect() as conn:
            ward_rows = conn.execute(WARD_EQUITY_QUERY).fetchall()
            material_rows = conn.execute(text("SELECT * FROM materials")).fetchall()

        ward_metrics = build_ward_equity_metrics(ward_rows)
        summary = summarize_equity_audit(ward_metrics)
        material_fairness = audit_material_recommendations(material_rows)

        return {
            **summary,
            # ward_metrics removed from here
            "material_fairness": material_fairness,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/audit/wards")
def get_equity_ward_metrics(
    page: int = 1,
    page_size: int = 30,
    constituency: str = None,
    sort_by: str = "equity"  # equity | rank-gap | marginalized | gender-gap | heat
):
    try:
        with engine.connect() as conn:
            ward_rows = conn.execute(WARD_EQUITY_QUERY).fetchall()

        ward_metrics = build_ward_equity_metrics(ward_rows)

        # filter by constituency
        if constituency and constituency != "all":
            ward_metrics = [
                w for w in ward_metrics
                if (w.get("assembly_constituency") or "Unknown") == constituency
            ]

        # sort
        sort_key = {
            "equity": lambda w: w["equity_rank"],
            "rank-gap": lambda w: -w["rank_gap"],
            "marginalized": lambda w: -w["marginalized_share"],
            "gender-gap": lambda w: -abs(0.5 - w["female_share"]),
            "heat": lambda w: w["heat_rank"],
        }.get(sort_by, lambda w: w["equity_rank"])

        ward_metrics.sort(key=sort_key)

        # paginate
        total = len(ward_metrics)
        start = (page - 1) * page_size
        end = start + page_size

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size,
            "wards": ward_metrics[start:end]
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/ward/{ward_id}")
def get_ward_equity_audit(ward_id: int):
    try:
        with engine.connect() as conn:
            ward_rows = conn.execute(WARD_EQUITY_QUERY).fetchall()

        ward_metrics = build_ward_equity_metrics(ward_rows)
        ward = next((row for row in ward_metrics if row["ward_id"] == ward_id), None)
        if not ward:
            raise HTTPException(status_code=404, detail="Ward not found")

        recommendation = "Maintain standard priority"
        if ward["equity_rank"] <= 25:
            recommendation = "Prioritize intervention funding and field validation"
        elif ward["rank_gap"] >= 15:
            recommendation = "Review priority manually before deprioritizing"

        return {
            **ward,
            "recommendation": recommendation,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
