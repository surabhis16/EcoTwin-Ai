import os
import joblib
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/uhi", tags=["UHI"])
engine = create_engine(os.getenv("DATABASE_URL"))

MODEL_PATH = "models/uhi_xgb_monotonic_model.pkl"
try:
    model = joblib.load(MODEL_PATH)
except Exception as e:
    model = None
    print(f"Error loading model: {e}")

class SimulationInput(BaseModel):
    ward_id: int  # corresponds to 'ward_number' in db
    intensity: float = Field(..., ge=0, le=1.0)

# risk assessment
# Determine heat risk level based on LST
def risk_level(lst: float) -> str:
    if lst < 35: 
        return "Low"
    elif lst < 40: 
        return "Moderate"
    elif lst < 45: 
        return "High"
    return "Extreme"

# ward metadata endpoints
# Populates the dropdown menu automatically from the db and returns list of all wards with their IDs and names
@router.get("/wards-metadata")
def get_wards_metadata():
    with engine.connect() as conn:
        query = text("""
            SELECT ward_number, ward_name_en 
            FROM bengaluru_wards 
            ORDER BY ward_name_en ASC
        """)
        result = conn.execute(query).fetchall()
        return [
            {
                "id": row.ward_number, 
                "name": row.ward_name_en
            } 
            for row in result
        ]

# bulk fetch for the 3D map to prevent performance lag; returns baseline data for all wards with coordinates
@router.get("/all-ward-baselines")
def get_all_baselines():
    with engine.connect() as conn:
        query = text("""
            SELECT ward_number, baseline_lst, baseline_ndvi,baseline_albedo,
                   ST_X(centroid) as lon, ST_Y(centroid) as lat
            FROM bengaluru_wards
        """)
        rows = conn.execute(query).fetchall()
        return {
            row.ward_number: {
                "lst": round(row.baseline_lst, 2),
                "ndvi": round(row.baseline_ndvi, 3),
                "albedo": round(row.baseline_albedo, 3),
                "lon": round(row.lon, 6),
                "lat": round(row.lat, 6)
            } 
            for row in rows
        }

# Fetches the current state of a single ward without simulation (Used when ward is selected in the UI)
@router.get("/ward-baseline/{ward_id}")
def get_ward_baseline(ward_id: int):
    with engine.connect() as conn:
        query = text("""
            SELECT ward_name_en, baseline_lst, baseline_ndvi, baseline_albedo, area_sqkm,
                   ST_X(centroid) as lon, ST_Y(centroid) as lat
            FROM bengaluru_wards 
            WHERE ward_number = :w_num
        """)
        ward = conn.execute(query, {"w_num": ward_id}).fetchone()

    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")

    return {
        "ward_id": ward_id,
        "ward_name": ward.ward_name_en,
        "area_sqkm": float(ward.area_sqkm),
        "lst_before": round(ward.baseline_lst, 2),
        "baseline_lst": round(ward.baseline_lst, 2),
        "ndvi_before": round(ward.baseline_ndvi, 3),
        "baseline_ndvi": round(ward.baseline_ndvi, 3),
        "albedo": round(ward.baseline_albedo, 3),
        "risk_before": risk_level(ward.baseline_lst),
        "risk_reduction": risk_level(ward.baseline_lst),  
        "coordinates": {
            "lon": round(ward.lon, 6),
            "lat": round(ward.lat, 6)
        }
    }

# simulation 
# Main simulation endpoint that predicts the impact of green infrastructure interventions on urban heat islands.
@router.post("/simulate-ward")
def simulate_ward(payload: SimulationInput):
    """
    1. Fetch ward baseline data from database
    2. Apply NDVI increase based on intervention intensity
    3. Use ML model to predict temperature change
    4. Calculate cooling effect and risk reduction
    """
    if model is None: 
        raise HTTPException(503, "Model not available")
    
    # Fetch ward data from db
    with engine.connect() as conn:
        query = text("""
            SELECT ward_name_en, baseline_lst, baseline_ndvi, baseline_albedo,
                     area_sqkm,
                   ST_X(centroid) as lon, ST_Y(centroid) as lat
            FROM bengaluru_wards 
            WHERE ward_number = :w_num
        """)
        ward = conn.execute(query, {"w_num": payload.ward_id}).fetchone()

    if not ward: 
        raise HTTPException(404, "Ward ID not found in database")

    # Apply intervention: increase NDVI based on intensity
    # intensity ranges from 0.0 to 1.0, representing NDVI increase
    ndvi_after = min(ward.baseline_ndvi + payload.intensity, 1.0)
    
    # Predict temperature change using ML model
    # Model predicts LST based on: [ndvi, albedo, lon, lat]
    df_before = pd.DataFrame([{
        "ndvi": ward.baseline_ndvi,
        "albedo": ward.baseline_albedo,
        "lon": ward.lon,
        "lat": ward.lat
    }])
    
    df_after = pd.DataFrame([{
        "ndvi": ndvi_after,
        "albedo": ward.baseline_albedo,
        "lon": ward.lon,
        "lat": ward.lat
    }])
    
    # Get predictions
    lst_before_pred = model.predict(df_before)[0]
    lst_after_pred = model.predict(df_after)[0]
    
    # Calculate synthetic delta from model
    raw_delta = float(lst_after_pred - lst_before_pred)

    # convert Surface Temp Delta to Air Temp Delta
    # apply a 0.33 factor because Air Temp changes slower than Surface Temp
    delta = raw_delta * 0.33
    
    # Anchor prediction to actual satellite-measured baseline
    lst_after = ward.baseline_lst + delta
    
    # Calculate cooling effect (always positive)
    cooling_effect = round(max(0, -delta), 2)
    
    # Prepare response with consistent field naming
    return {
        # Identification
        "ward_id": payload.ward_id,
        "ward_name": ward.ward_name_en,
        "intervention": "green cover enhancement",
        "intensity": round(payload.intensity * 100, 0),  
        "area_sqkm": float(ward.area_sqkm),
        
        # Temperature Metrics (using frontend-expected field names)
        "cooling": cooling_effect,
        "cooling_effect": cooling_effect, 
        "lst_before": round(ward.baseline_lst, 2),
        "baseline_lst": round(ward.baseline_lst, 2),  
        "lst_after": round(lst_after, 2),
        
        # NDVI Metrics 
        "ndvi_before": round(ward.baseline_ndvi, 3),
        "baseline_ndvi": round(ward.baseline_ndvi, 3), 
        "ndvi_after": round(ndvi_after, 3),
        
        # Risk Assessment
        "risk_before": risk_level(ward.baseline_lst),
        "risk_after": risk_level(lst_after),
        "risk_reduction": f"{risk_level(ward.baseline_lst)} → {risk_level(lst_after)}",
        
        # Additional Metadata
        "baseline_albedo": round(ward.baseline_albedo, 3),
        "coordinates": {
            "lon": round(ward.lon, 6),
            "lat": round(ward.lat, 6)
        },
        
        # Model Delta (for debugging)
        "model_delta": round(delta, 2)
    }

# hotspot analysis
# returns wards with highest uhi effect
# for "Zoom to Hotspots" feature in 3D visualization
@router.get("/bengaluru-hotspots")
def get_hotspots(threshold: float = 40.0, limit: int = 10):
    with engine.connect() as conn:
        query = text("""
            SELECT ward_number, ward_name_en, baseline_lst, baseline_ndvi,
                   ST_X(centroid) as lon, ST_Y(centroid) as lat
            FROM bengaluru_wards
            WHERE baseline_lst >= :threshold
            ORDER BY baseline_lst DESC
            LIMIT :limit
        """)
        rows = conn.execute(query, {"threshold": threshold, "limit": limit}).fetchall()
        
        hotspots = [
            {
                "ward_id": row.ward_number,
                "ward_name": row.ward_name_en,
                "lst_before": round(row.baseline_lst, 2),
                "ndvi": round(row.baseline_ndvi, 3),
                "risk_level": risk_level(row.baseline_lst),
                "lon": round(row.lon, 6),
                "lat": round(row.lat, 6)
            }
            for row in rows
        ]
        
        return {
            "threshold": threshold,
            "count": len(hotspots),
            "hotspots": hotspots
        }

# stats 
# returns overall city-level statistics for dashboard summary
@router.get("/city-statistics")
def get_city_statistics():
    with engine.connect() as conn:
        query = text("""
            SELECT 
                COUNT(*) as total_wards,
                AVG(baseline_lst) as avg_lst,
                MAX(baseline_lst) as max_lst,
                MIN(baseline_lst) as min_lst,
                AVG(baseline_ndvi) as avg_ndvi,
                SUM(CASE WHEN baseline_lst >= 45 THEN 1 ELSE 0 END) as extreme_risk_count,
                SUM(CASE WHEN baseline_lst >= 40 AND baseline_lst < 45 THEN 1 ELSE 0 END) as high_risk_count,
                SUM(CASE WHEN baseline_lst >= 35 AND baseline_lst < 40 THEN 1 ELSE 0 END) as moderate_risk_count,
                SUM(CASE WHEN baseline_lst < 35 THEN 1 ELSE 0 END) as low_risk_count
            FROM bengaluru_wards
        """)
        stats = conn.execute(query).fetchone()
        
        return {
            "total_wards": stats.total_wards,
            "temperature": {
                "average": round(stats.avg_lst, 2),
                "max": round(stats.max_lst, 2),
                "min": round(stats.min_lst, 2)
            },
            "ndvi": {
                "average": round(stats.avg_ndvi, 3)
            },
            "risk_distribution": {
                "extreme": stats.extreme_risk_count,
                "high": stats.high_risk_count,
                "moderate": stats.moderate_risk_count,
                "low": stats.low_risk_count
            }
        }


# fetches the latest aqi data for all wards to display on the 3D map
@router.get("/all-ward-aqi")
def get_all_ward_aqi():
    with engine.connect() as conn:
        query = text("""
            SELECT ward_number, aqi 
            FROM bengaluru_wards 
            WHERE aqi IS NOT NULL
        """)
        rows = conn.execute(query).fetchall()
        
        return [
            {
                "ward_number": row.ward_number,
                "aqi": round(float(row.aqi), 2)
            }
            for row in rows
        ]