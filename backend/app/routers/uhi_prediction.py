from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import joblib
import pandas as pd
import numpy as np
from typing import List, Optional
import os

router = APIRouter(prefix="/api/uhi", tags=["Urban Heat Island"])

# load trained rf model
MODEL_PATH = "models/green_cover_rf_model.pkl"
SAMPLE_DATA_PATH = "data/green_cover_impact.csv"

try:
    model = joblib.load(MODEL_PATH)
    print(f" Random Forest model loaded from {MODEL_PATH}")
    print(f"   Expected features: {model.n_features_in_}")
    if hasattr(model, 'feature_names_in_'):
        print(f"   Feature names: {list(model.feature_names_in_)}")
except Exception as e:
    print(f" Failed to load model: {e}")
    model = None


# req-response models

class PredictionInput(BaseModel):
    ndvi: float = Field(..., ge=0, le=1, description="Current NDVI (0-1)")
    lon: float = Field(..., description="Longitude")
    lat: float = Field(..., description="Latitude")
    green_cover_increase: float = Field(0.2, ge=0, le=1, description="NDVI increase amount")

class PredictionOutput(BaseModel):
    lon: float
    lat: float
    ndvi_before: float
    ndvi_after: float
    lst_before: float
    lst_after: float
    cooling_effect: float
    risk_reduction: str

class BatchPredictionInput(BaseModel):
    locations: List[PredictionInput]

class AreaSimulationInput(BaseModel):
    area_name: str
    bounds: dict  # {"min_lon": x, "max_lon": y, "min_lat": a, "max_lat": b}
    green_cover_increase: float = 0.2
    grid_resolution: int = 20  # Number of points per dimension


# helper fns

def calculate_risk_level(lst: float) -> str:
    """Categorize LST into risk levels"""
    if lst < 35:
        return "Low"
    elif lst < 40:
        return "Moderate"
    elif lst < 45:
        return "High"
    else:
        return "Extreme"

def predict_lst(ndvi: float, lon: float, lat: float) -> float:
    """Predict LST for given location and NDVI"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not available")
    
    features = pd.DataFrame({
        'ndvi': [ndvi],
        'lon': [lon],
        'lat': [lat]
    })
    
    prediction = model.predict(features)[0]
    return float(prediction)


# api endpoints

@router.get("/health")
async def health_check():
    """Check if model is loaded and ready"""
    return {
        "status": "healthy" if model is not None else "model_not_loaded",
        "model_loaded": model is not None,
        "model_path": MODEL_PATH
    }


@router.post("/predict", response_model=PredictionOutput)
async def predict_cooling_effect(input_data: PredictionInput):
    """
    Predict cooling effect of green cover increase at a specific location
    
    - **ndvi**: Current vegetation index (0-1)
    - **lon**: Longitude coordinate
    - **lat**: Latitude coordinate  
    - **green_cover_increase**: Amount to increase NDVI (default 0.2)
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Predict current LST (before intervention)
        lst_before = predict_lst(input_data.ndvi, input_data.lon, input_data.lat)
        
        # Calculate new NDVI after intervention
        ndvi_after = min(input_data.ndvi + input_data.green_cover_increase, 1.0)
        
        # Predict future LST (after intervention)
        lst_after = predict_lst(ndvi_after, input_data.lon, input_data.lat)
        
        # Calculate cooling effect
        cooling_effect = lst_before - lst_after
        
        # Determine risk reduction
        risk_before = calculate_risk_level(lst_before)
        risk_after = calculate_risk_level(lst_after)
        risk_reduction = f"{risk_before} → {risk_after}"
        
        return PredictionOutput(
            lon=input_data.lon,
            lat=input_data.lat,
            ndvi_before=input_data.ndvi,
            ndvi_after=ndvi_after,
            lst_before=lst_before,
            lst_after=lst_after,
            cooling_effect=cooling_effect,
            risk_reduction=risk_reduction
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/predict-batch")
async def predict_batch(input_data: BatchPredictionInput):
    """Predict cooling effects for multiple locations"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    results = []
    for location in input_data.locations:
        try:
            result = await predict_cooling_effect(location)
            results.append(result)
        except Exception as e:
            print(f"Failed to predict for {location.lon}, {location.lat}: {e}")
            continue
    
    return results


@router.post("/simulate-area")
async def simulate_area(input_data: AreaSimulationInput):
    """
    Simulate green cover intervention across an entire area using grid sampling
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    bounds = input_data.bounds
    resolution = input_data.grid_resolution
    
    # Create grid of points across the area
    lons = np.linspace(bounds["min_lon"], bounds["max_lon"], resolution)
    lats = np.linspace(bounds["min_lat"], bounds["max_lat"], resolution)
    
    results = []
    
    for lon in lons:
        for lat in lats:
            # assume baseline NDVI of 0.3 for now (can be improved with real data later)
            ndvi_baseline = 0.3
            
            try:
                prediction = await predict_cooling_effect(
                    PredictionInput(
                        ndvi=ndvi_baseline,
                        lon=lon,
                        lat=lat,
                        green_cover_increase=input_data.green_cover_increase
                    )
                )
                results.append(prediction)
            except:
                continue
    
    # Calculate aggregate statistics
    cooling_effects = [r.cooling_effect for r in results]
    
    return {
        "area_name": input_data.area_name,
        "total_points": len(results),
        "average_cooling": np.mean(cooling_effects),
        "max_cooling": np.max(cooling_effects),
        "min_cooling": np.min(cooling_effects),
        "predictions": results
    }


@router.get("/sample-data")
async def get_sample_predictions():
    """
    Get pre-computed predictions from CSV
    """
    try:
        if not os.path.exists(SAMPLE_DATA_PATH):
            raise HTTPException(status_code=404, detail="Sample data not found")
        
        df = pd.read_csv(SAMPLE_DATA_PATH)
        
        # Return first 100 points for performance
        sample = df.head(100).to_dict(orient="records")
        
        return {
            "total_points": len(df),
            "returned_points": len(sample),
            "data": sample,
            "summary": {
                "avg_cooling": float(df["cooling"].mean()),
                "max_cooling": float(df["cooling"].max()),
                "min_cooling": float(df["cooling"].min()),
                "avg_lst_before": float(df["lst_before"].mean()),
                "avg_lst_after": float(df["lst_after"].mean())
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bengaluru-hotspots")
async def get_hotspots(threshold: float = 45.0):
    """
    Get locations with LST above threshold (heat hotspots)
    """
    try:
        if not os.path.exists(SAMPLE_DATA_PATH):
            raise HTTPException(status_code=404, detail="Sample data not found")
        
        df = pd.read_csv(SAMPLE_DATA_PATH)
        hotspots = df[df["lst_before"] > threshold]
        
        return {
            "threshold": threshold,
            "total_hotspots": len(hotspots),
            "hotspots": hotspots.head(50).to_dict(orient="records")
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))