from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import pandas as pd
import numpy as np

load_dotenv()

router = APIRouter(prefix="/api/materials", tags=["materials"])
engine = create_engine(os.getenv("DATABASE_URL"))

class MaterialRequest(BaseModel):
    ward_name: str
    application: str = "Wall"
    preferences: Dict[str, float] = {
        "cost": 0.25,
        "health": 0.25,
        "cooling": 0.25,
        "sustainability": 0.25
    }
    top_n: int = 5

class MaterialResponse(BaseModel):
    material_name: str
    usage_type: str
    price_inr_per_m3: float
    final_score: float
    cooling_index: float
    voc_rating: float
    transport_adjusted_carbon: float
    thermal_conductivity: float
    solar_reflective_index: float
    specific_heat: float
    predicted_impact: Dict[str, float]

# normalize pandas series to 0-1 range
def normalize(series: pd.Series) -> pd.Series:
    if series.empty:
        return pd.Series(0.5, index=series.index)
    
    min_v = series.min()
    max_v = series.max()
    
    if max_v == min_v:
        return pd.Series(0.5, index=series.index)
    
    return (series - min_v) / (max_v - min_v)

# computes a bounded Cooling Index in range [0, 1] using thermal conductivity, solar reflectance, and specific heat
def compute_cooling_index(df: pd.DataFrame) -> pd.Series:
    """
    """
    # Normalize physical properties
    k_norm = normalize(df["thermal_conductivity"])
    sri_norm = normalize(df["solar_reflective_index"])
    cp_norm = normalize(df["specific_heat"])
    
    # Invert thermal conductivity (cause lower is better for cooling)
    k_inv = 1 - k_norm
    
    # Weighted composite index
    cooling_index = (
        0.45 * k_inv +      # 45% weight on low conductivity
        0.35 * sri_norm +   # 35% weight on high reflectance
        0.20 * cp_norm      # 20% weight on high heat capacity
    )
    
    # clip to 0-1 range for numerical safety
    return np.clip(cooling_index, 0, 1)

# get heat multiplier based on ward's baseline LST from database
def get_heat_multiplier_from_lst(ward_name: str) -> float:
    try:
        with engine.connect() as conn:
            query = text("""
                SELECT baseline_lst, baseline_ndvi 
                FROM bengaluru_wards 
                WHERE LOWER(ward_name_en) = LOWER(:ward_name)
                LIMIT 1
            """)
            result = conn.execute(query, {"ward_name": ward_name}).fetchone()
        
        if not result:
            print(f"Ward '{ward_name}' not found, using default multiplier")
            return 1.25
        
        baseline_lst = result.baseline_lst
        
        # Calculate UHI index based on LST
        if baseline_lst < 35:
            uhi_index = 0.2  # Low
        elif baseline_lst < 40:
            uhi_index = 0.5  # Moderate
        elif baseline_lst < 45:
            uhi_index = 0.8  # High
        else:
            uhi_index = 1.0  # Extreme
        
        heat_multiplier = 0.75 + uhi_index
        
        print(f"Ward: {ward_name} | LST: {baseline_lst}°C | Heat Multiplier: {heat_multiplier}")
        return heat_multiplier
    
    except Exception as e:
        print(f"Error getting heat multiplier: {e}")
        return 1.25

# recommend materials based on ward LST, application, and user preferences
@router.post("/recommend", response_model=List[MaterialResponse])
async def recommend_materials(request: MaterialRequest):
    try:
        # fetch materials from database
        with engine.connect() as conn:
            query = text("SELECT * FROM materials")
            result = conn.execute(query).fetchall()
        
        if not result:
            raise HTTPException(status_code=404, detail="No materials found in database")
        
        # conv to DataFrame
        df = pd.DataFrame([dict(row._mapping) for row in result])
        
        # compute cooling index from physical properties
        # print("Computing cooling index from physical properties...")
        df["cooling_norm"] = compute_cooling_index(df)
        
        # get heat multiplier from ward's baseline LST
        heat_multiplier = get_heat_multiplier_from_lst(request.ward_name)
        
        # filter by application
        df_filtered = df[
            df["usage_type"].str.contains(request.application, case=False, na=False) |
            df["applications"].str.contains(request.application, case=False, na=False)
        ].copy()
        
        if df_filtered.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No materials found for application: {request.application}"
            )
        
        # normalize other metrics
        df_filtered["cost_norm"] = 1 - normalize(df_filtered["price_inr_per_m3"])
        df_filtered["health_norm"] = 1 - normalize(df_filtered["voc_rating"])
        df_filtered["sustain_norm"] = 1 - normalize(df_filtered["transport_adjusted_carbon"])
        
        # calculate Final Score
        prefs = request.preferences
        df_filtered["final_score"] = (
            prefs["cost"] * df_filtered["cost_norm"] +
            prefs["health"] * df_filtered["health_norm"] +
            prefs["cooling"] * df_filtered["cooling_norm"] * heat_multiplier +
            prefs["sustainability"] * df_filtered["sustain_norm"]
        )
        
        # sort and get top N
        top_materials = df_filtered.nlargest(request.top_n, "final_score")
        
        # calculate predicted impact for each material
        results = []
        for _, material in top_materials.iterrows():
            cooling_normalized = material["cooling_norm"]  # Already 0-1
            
            # temperature reduction: scale 0-1 to realistic 0.5-8°C range
            # higher heat multiplier = more benefit in hot areas
            temp_reduction = cooling_normalized * heat_multiplier * 2.5  
            
            # Carbon score: transport_adjusted_carbon is in kg CO2/kg (0.13-2.025 range)
            # Lower carbon = better material
            carbon_value = material["transport_adjusted_carbon"]
            max_carbon = 2.5  # Slightly above max observed value
            carbon_score = (carbon_value / max_carbon) * 100  # 0-100 scale
            carbon_score = min(carbon_score, 100)  # Cap at 100
            
            # CO2 reduction: better materials (lower carbon) give more offset
            # Materials with low embodied carbon = high CO2 reduction potential
            co2_reduction = (100 - carbon_score) * 2.0 + 50  # 50-250 kg/m²/yr range
            
            # Sustainability boost
            sustainability_boost = material["final_score"] * 15
            
            results.append(MaterialResponse(
                material_name=material["material_name"],
                usage_type=material["usage_type"],
                price_inr_per_m3=float(material["price_inr_per_m3"]),
                final_score=float(material["final_score"]),
                cooling_index=float(material["cooling_norm"]),  # normalized 0-1 value
                voc_rating=float(material["voc_rating"]),
                transport_adjusted_carbon=float(material["transport_adjusted_carbon"]),
                thermal_conductivity=float(material["thermal_conductivity"]),
                solar_reflective_index=float(material["solar_reflective_index"]),
                specific_heat=float(material["specific_heat"]),
                predicted_impact={
                    "tempChange": -round(temp_reduction, 2),
                    "co2Reduction": round(co2_reduction, 2),
                    "sustainabilityChange": round(sustainability_boost, 2)
                }
            ))
        
        print(f"Recommended {len(results)} materials for {request.ward_name}")
        return results
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in recommend_materials: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# get list of available material applications
@router.get("/applications")
async def get_applications():
    try:
        with engine.connect() as conn:
            query = text("""
                SELECT DISTINCT usage_type, applications 
                FROM materials
            """)
            result = conn.execute(query).fetchall()
        
        applications = set()
        for row in result:
            if row.usage_type:
                applications.add(row.usage_type)
            if row.applications:
                apps = row.applications.split(",")
                applications.update([app.strip() for app in apps])
        
        return {"applications": sorted(list(applications))}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# get heat info for a specific ward
@router.get("/ward-heat-info/{ward_name}")
async def get_ward_heat_info(ward_name: str):
    try:
        with engine.connect() as conn:
            query = text("""
                SELECT ward_name_en, baseline_lst, baseline_ndvi, baseline_albedo
                FROM bengaluru_wards 
                WHERE LOWER(ward_name_en) = LOWER(:ward_name)
                LIMIT 1
            """)
            result = conn.execute(query, {"ward_name": ward_name}).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail=f"Ward '{ward_name}' not found")
        
        lst = result.baseline_lst
        
        if lst < 35:
            heat_zone = "Low"
        elif lst < 40:
            heat_zone = "Moderate"
        elif lst < 45:
            heat_zone = "High"
        else:
            heat_zone = "Extreme"
        
        heat_multiplier = get_heat_multiplier_from_lst(ward_name)
        
        return {
            "ward_name": result.ward_name_en,
            "baseline_lst": round(lst, 2),
            "baseline_ndvi": round(result.baseline_ndvi, 3),
            "baseline_albedo": round(result.baseline_albedo, 3),
            "heat_zone": heat_zone,
            "heat_multiplier": round(heat_multiplier, 2),
            "recommendation": f"Materials with high cooling properties prioritized for {heat_zone.lower()} heat zones"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# debug endpoint to verify cooling index calculation; shows sample materials with their computed cooling indices
@router.get("/debug-cooling-calculation")
async def debug_cooling_calculation():
    try:
        with engine.connect() as conn:
            query = text("""
                SELECT 
                    material_name,
                    thermal_conductivity,
                    solar_reflective_index,
                    specific_heat
                FROM materials
                LIMIT 10
            """)
            result = conn.execute(query).fetchall()
        
        df = pd.DataFrame([dict(row._mapping) for row in result])
        df["cooling_index_computed"] = compute_cooling_index(df)
        
        debug_results = []
        for _, row in df.iterrows():
            debug_results.append({
                "material": row["material_name"],
                "thermal_conductivity": round(row["thermal_conductivity"], 3),
                "solar_reflective_index": round(row["solar_reflective_index"], 2),
                "specific_heat": round(row["specific_heat"], 3),
                "cooling_index": round(row["cooling_index_computed"], 3)
            })
        
        return {
            "note": "Cooling index computed from physical properties (0-1 scale)",
            "formula": "45% × (1 - thermal_conductivity_norm) + 35% × solar_reflective_norm + 20% × specific_heat_norm",
            "samples": debug_results
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))