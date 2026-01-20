
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import pandas as pd
import numpy as np
import joblib
from sklearn.preprocessing import MinMaxScaler
import traceback # Added for better error logging

load_dotenv()

router = APIRouter(prefix="/api/materials", tags=["materials"])

# --- DATABASE CONNECTION (Optimized for Stability) ---
engine = create_engine(
    os.getenv("DATABASE_URL"), 
    pool_pre_ping=True,  # Checks connection before use (Fixes "server closed connection" error)
    pool_recycle=3600    # Refreshes connection every hour
)

# --- 1. Load the Trained ML Model ---
model_path = "models/climate_material_model.pkl"
rf_model = None

try:
    rf_model = joblib.load(model_path)
    print(f"ML Model loaded successfully from {model_path}")
except Exception as e:
    print(f"WARNING: Could not load ML model: {e}. Recommendations will fail without it.")

# --- 2. Data Structures ---
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
    predicted_zone_suitability: str
    embodied_carbon: float
    cooling_index: float
    voc_rating: float
    predicted_impact: Dict[str, float]

# --- 3. Helper Functions ---

def prepare_features_for_model(df: pd.DataFrame) -> pd.DataFrame:
    """ Maps Database Schema columns to the exact Feature Names used during Model Training. """
    column_mapping = {
        "thermal_conductivity": "Thermal_Conductivity_W_mK",
        "specific_heat": "Specific_Heat_kJ_kgK",
        "solar_reflective_index": "Solar_Reflective_Index",
        "embodied_carbon": "Embodied_Carbon_kgCO2_kg",
        "price_inr_per_m3": "Price_INR_per_m3",
        "voc_rating": "VOC_Rating",
        "recycled_content": "Recycled_Content_percent",
        "source_distance_km": "Source_Distance_KM",
        "local_availability": "Local_Availability_1_10"
    }
    
    df_mapped = df.rename(columns=column_mapping)
    
    required_features = [
        'Thermal_Conductivity_W_mK', 'Specific_Heat_kJ_kgK', 'Solar_Reflective_Index', 
        'Embodied_Carbon_kgCO2_kg', 'Price_INR_per_m3', 'VOC_Rating', 'Recycled_Content_percent',
        'Source_Distance_KM', 'Local_Availability_1_10'
    ]
    
    for feature in required_features:
        if feature not in df_mapped.columns:
            df_mapped[feature] = 0
            
    return df_mapped[required_features]

def get_ward_heat_zone(ward_name: str) -> str:
    """ Fetches Ward LST and maps it to Model Classes: 'High', 'Medium', 'Low'. """
    try:
        with engine.connect() as conn:
            query = text("""
                SELECT baseline_lst 
                FROM bengaluru_wards 
                WHERE LOWER(ward_name_en) = LOWER(:ward_name)
                LIMIT 1
            """)
            result = conn.execute(query, {"ward_name": ward_name}).fetchone()
        
        if not result:
            print(f"Ward '{ward_name}' not found. Defaulting to Medium.")
            return "Medium"
        
        lst = result.baseline_lst
        
        if lst < 35: return "Low"
        elif lst < 40: return "Medium"
        else: return "High" 
            
    except Exception as e:
        print(f"Error fetching ward zone: {e}")
        return "Medium"

def get_heat_multiplier_from_lst(ward_name: str) -> float:
    try:
        with engine.connect() as conn:
            query = text("SELECT baseline_lst FROM bengaluru_wards WHERE LOWER(ward_name_en) = LOWER(:ward_name)")
            result = conn.execute(query, {"ward_name": ward_name}).fetchone()
        if not result: return 1.25
        lst = result.baseline_lst
        if lst < 35: return 0.95
        elif lst < 40: return 1.25
        elif lst < 45: return 1.55
        else: return 1.75
    except: return 1.25

# --- 4. Main Recommendation Endpoint ---
@router.post("/recommend", response_model=List[MaterialResponse])
async def recommend_materials(request: MaterialRequest):
    try:
        if rf_model is None:
            raise HTTPException(status_code=500, detail="ML Model is not loaded.")

        # A. Fetch all materials from DB
        with engine.connect() as conn:
            query = text("SELECT * FROM materials")
            result = conn.execute(query).fetchall()
        
        if not result:
            raise HTTPException(status_code=404, detail="No materials found in database")
            
        # Convert to DataFrame
        df = pd.DataFrame([dict(row._mapping) for row in result])
        
        # B. Get Ward Heat Zone (Target)
        target_zone = get_ward_heat_zone(request.ward_name)
        heat_multiplier = get_heat_multiplier_from_lst(request.ward_name)
        
        # C. ML PREDICTION
        X_features = prepare_features_for_model(df)
        df['Predicted_Zone'] = rf_model.predict(X_features)
        
        # Filter: Keep materials that match the Ward's Zone
        suitable_df = df[df['Predicted_Zone'] == target_zone].copy()
        
        # Apply Application Filter to exact matches first
        if not suitable_df.empty:
             suitable_df = suitable_df[
                suitable_df["usage_type"].str.contains(request.application, case=False, na=False) |
                suitable_df["applications"].str.contains(request.application, case=False, na=False)
            ].copy()

        # --- D. FALLBACK STRATEGY (The Fix for 404/500 Errors) ---
        if suitable_df.empty:
            print(f"⚠️ No exact match for {target_zone} & {request.application}. Switching to Fallback Strategy.")
            
            # Fallback 1: Ignore Heat Zone, just match Application (e.g. "Wall")
            # We prioritize materials with high cooling index since the original goal failed
            suitable_df = df[
                df["usage_type"].str.contains(request.application, case=False, na=False) |
                df["applications"].str.contains(request.application, case=False, na=False)
            ].copy()
            
            # Sort fallback by cooling index so we still give good results
            if "cooling_index" in suitable_df.columns:
                 suitable_df = suitable_df.sort_values(by="cooling_index", ascending=False)

        if suitable_df.empty:
            print(f"⚠️ Application match failed for {request.application}. Switching to Global Top Cooling.")
            # Fallback 2: If even application fails, just take top cooling materials generally
            if "cooling_index" in df.columns:
                 suitable_df = df.sort_values(by="cooling_index", ascending=False).head(10).copy()
            else:
                 suitable_df = df.sort_values(by="solar_reflective_index", ascending=False).head(10).copy()

        # E. RANKING (User Weights)
        scaler = MinMaxScaler()
        prefs = request.preferences
        
        if not suitable_df.empty:
            if "cost" in prefs:
                norm_price = scaler.fit_transform(suitable_df[["price_inr_per_m3"]])
                suitable_df["score_cost"] = 1 - norm_price
                
            if "sustainability" in prefs:
                norm_carbon = scaler.fit_transform(suitable_df[["embodied_carbon"]])
                suitable_df["score_sustain"] = 1 - norm_carbon
                
            if "health" in prefs:
                norm_voc = scaler.fit_transform(suitable_df[["voc_rating"]])
                suitable_df["score_health"] = 1 - norm_voc
                
            if "cooling" in prefs:
                if "cooling_index" in suitable_df.columns:
                     norm_cool = scaler.fit_transform(suitable_df[["cooling_index"]])
                     suitable_df["score_cooling"] = norm_cool
                else:
                     norm_cool = scaler.fit_transform(suitable_df[["solar_reflective_index"]])
                     suitable_df["score_cooling"] = norm_cool

            # Calculate Final Score
            suitable_df["final_score"] = 0
            total_weight = sum(prefs.values())
            if total_weight == 0: total_weight = 1
            
            for key in prefs:
                col = f"score_{key}"
                if col in suitable_df.columns:
                    suitable_df["final_score"] += suitable_df[col] * (prefs[key] / total_weight)
        
        # F. Formatting Response
        # Safety check: if fallback completely failed (very rare), return empty list
        if suitable_df.empty:
             return []

        top_materials = suitable_df.sort_values(by="final_score", ascending=False).head(request.top_n)
        
        results = []
        for _, row in top_materials.iterrows():
            cool_idx = row.get("cooling_index", 0)
            temp_reduction = (cool_idx / 2333) * heat_multiplier * 2.5
            
            results.append(MaterialResponse(
                material_name=row["material_name"],
                usage_type=row["usage_type"],
                price_inr_per_m3=float(row["price_inr_per_m3"]),
                final_score=round(float(row.get("final_score", 0)), 2),
                predicted_zone_suitability=row.get("Predicted_Zone", "General"), # Fallback default
                embodied_carbon=float(row["embodied_carbon"]),
                cooling_index=float(row.get("cooling_index", 0)),
                voc_rating=float(row.get("voc_rating", 0)),
                predicted_impact={
                    "tempChange": -round(temp_reduction, 2),
                    "co2Reduction": round((1 - row.get("transport_adjusted_carbon", 1)) * 100, 2),
                    "sustainabilityScore": round(row.get("final_score", 0) * 10, 1)
                }
            ))
            
        return results

    except Exception as e:
        print("CRITICAL ERROR IN RECOMMENDATION:")
        traceback.print_exc() # Print full error to console for debugging
        raise HTTPException(status_code=500, detail=str(e))

# --- 5. Auxiliary Endpoints (Unchanged) ---

@router.get("/applications")
async def get_applications():
    try:
        with engine.connect() as conn:
            query = text("SELECT DISTINCT usage_type, applications FROM materials")
            result = conn.execute(query).fetchall()
        
        applications = set()
        for row in result:
            if row.usage_type: applications.add(row.usage_type)
            if row.applications:
                apps = row.applications.split(",")
                applications.update([app.strip() for app in apps])
        
        return {"applications": sorted(list(applications))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        if lst < 35: heat_zone = "Low"
        elif lst < 40: heat_zone = "Moderate"
        elif lst < 45: heat_zone = "High"
        else: heat_zone = "Extreme"
        
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/debug-cooling-calculation")
async def debug_cooling_calculation():
    try:
        with engine.connect() as conn:
            query = text("""
                SELECT material_name, thermal_conductivity, solar_reflective_index, specific_heat, cooling_index
                FROM materials LIMIT 10
            """)
            result = conn.execute(query).fetchall()
        
        debug_results = []
        for row in result:
            debug_results.append({
                "material": row.material_name,
                "cooling_index_db": row.cooling_index,
                "thermal_conductivity": row.thermal_conductivity,
                "solar_reflective_index": row.solar_reflective_index
            })
        return {"samples": debug_results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))