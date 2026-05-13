import os
import joblib
import shap
import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/xai", tags=["XAI"])
engine = create_engine(os.getenv("DATABASE_URL"))

MODEL_PATH = "models/uhi_xgb_monotonic_model.pkl"
FEATURES = ["ndvi", "albedo", "lon", "lat"]

FEATURE_LABELS = {
    "ndvi": "Vegetation Density (NDVI)",
    "albedo": "Surface Reflectivity (Albedo)",
    "lon": "Longitude",
    "lat": "Latitude"
}

try:
    model = joblib.load(MODEL_PATH)
    # build explainer once at startup 
    explainer = shap.TreeExplainer(model)
    print("SHAP explainer initialized successfully")
except Exception as e:
    model = None
    explainer = None
    print(f"Error loading model/explainer: {e}")


class ExplainInput(BaseModel):
    ward_id: int
    intensity: float = Field(..., ge=0, le=1.0)
    albedo_increase: float = Field(default=0.0, ge=0, le=0.5)


def predict_lst(feature_frame: pd.DataFrame) -> float:
    feature_frame = feature_frame[FEATURES].astype(float)
    try:
        return float(model.predict(feature_frame)[0])
    except ValueError as exc:
        if "feature names" not in str(exc).lower():
            raise
        return float(model.predict(feature_frame.to_numpy(), validate_features=False)[0])


# Returns SHAP explanation for a UHI simulation; Explains both the before and after states, and the delta
@router.post("/explain-simulation")
def explain_simulation(payload: ExplainInput):
    if model is None or explainer is None:
        raise HTTPException(503, "XAI model not available")

    # fetch ward data
    with engine.connect() as conn:
        query = text("""
            SELECT ward_name_en, baseline_lst, baseline_ndvi, baseline_albedo,
                   ST_X(centroid) as lon, ST_Y(centroid) as lat
            FROM bengaluru_wards
            WHERE ward_number = :w_num
        """)
        ward = conn.execute(query, {"w_num": payload.ward_id}).fetchone()

    if not ward:
        raise HTTPException(404, "Ward not found")

    ndvi_after = min(ward.baseline_ndvi + payload.intensity, 1.0)
    albedo_after = min(ward.baseline_albedo + payload.albedo_increase, 1.0)

    # build before/after feature rows
    df_before = pd.DataFrame([{
        "ndvi": ward.baseline_ndvi,
        "albedo": ward.baseline_albedo,
        "lon": ward.lon,
        "lat": ward.lat
    }])

    df_after = pd.DataFrame([{
        "ndvi": ndvi_after,
        "albedo": albedo_after,
        "lon": ward.lon,
        "lat": ward.lat
    }])

    # compute SHAP values for before and after
    shap_before = explainer.shap_values(df_before)[0]  # shape: (4,)
    shap_after = explainer.shap_values(df_after)[0]

    # base value (expected model output across training data)
    base_value = float(explainer.expected_value)

    # predicted LST from model
    lst_before_pred = predict_lst(df_before)
    lst_after_pred = predict_lst(df_after)

    # SHAP delta - how each feature's contribution changed
    shap_delta = shap_after - shap_before

    # build explanation per feature
    def build_feature_explanations(shap_vals, feature_row):
        explanations = []
        for i, feature in enumerate(FEATURES):
            val = float(feature_row.iloc[0][feature])
            contribution = float(shap_vals[i])
            explanations.append({
                "feature": feature,
                "label": FEATURE_LABELS[feature],
                "value": round(val, 4),
                "shap_value": round(contribution, 4),
                # direction: positive means pushing LST higher, negative means cooling
                "direction": "warming" if contribution > 0 else "cooling",
                "magnitude": round(abs(contribution), 4)
            })
        # sort by magnitude descending
        explanations.sort(key=lambda x: x["magnitude"], reverse=True)
        return explanations

    before_explanations = build_feature_explanations(shap_before, df_before)
    after_explanations = build_feature_explanations(shap_after, df_after)

    # delta explanations — what changed because of the intervention
    delta_explanations = []
    for i, feature in enumerate(FEATURES):
        delta = float(shap_delta[i])
        if abs(delta) > 0.001:  # only include meaningful changes
            delta_explanations.append({
                "feature": feature,
                "label": FEATURE_LABELS[feature],
                "shap_delta": round(delta, 4),
                "direction": "warming" if delta > 0 else "cooling",
                "magnitude": round(abs(delta), 4)
            })
    delta_explanations.sort(key=lambda x: x["magnitude"], reverse=True)

    # dominant driver of cooling
    primary_driver = delta_explanations[0] if delta_explanations else None

    # human readable summary
    if primary_driver:
        # check if albedo is also a significant contributor
        albedo_entry = next((d for d in delta_explanations if d["feature"] == "albedo"), None)
        albedo_significant = (
            albedo_entry and
            albedo_entry["magnitude"] / primary_driver["magnitude"] > 0.5
        )

        if albedo_significant and primary_driver["feature"] == "ndvi":
            summary = (
                f"The predicted cooling in {ward.ward_name_en} is driven by two factors: "
                f"increased {primary_driver['label']} ({primary_driver['magnitude']:.3f}°C) "
                f"and improved {albedo_entry['label']} ({albedo_entry['magnitude']:.3f}°C). "
                f"This reflects the combined effect of vegetation and reflective surface interventions."
            )
        else:
            summary = (
                f"The predicted cooling in {ward.ward_name_en} is primarily driven by the "
                f"increase in {primary_driver['label']}, which contributed a "
                f"{primary_driver['magnitude']:.3f}°C reduction in predicted surface temperature. "
                f"Geographic location accounts for the remaining variance."
            )
    else:
        summary = f"No significant feature contribution change detected for {ward.ward_name_en}."

    return {
        "ward_id": payload.ward_id,
        "ward_name": ward.ward_name_en,
        "intensity": round(payload.intensity * 100, 0),

        # model internals
        "base_value": round(base_value, 4),
        "lst_before_predicted": round(lst_before_pred, 4),
        "lst_after_predicted": round(lst_after_pred, 4),
        "raw_delta": round(lst_after_pred - lst_before_pred, 4),

        # feature inputs
        "inputs": {
            "before": {
                "ndvi": round(ward.baseline_ndvi, 4),
                "albedo": round(ward.baseline_albedo, 4),
                "lon": round(ward.lon, 6),
                "lat": round(ward.lat, 6)
            },
            "after": {
                "ndvi": round(ndvi_after, 4),
                "albedo": round(albedo_after, 4),
                "lon": round(ward.lon, 6),
                "lat": round(ward.lat, 6)
            }
        },

        # SHAP explanations
        "explanation": {
            "before": before_explanations,
            "after": after_explanations,
            "delta": delta_explanations,
            "primary_driver": primary_driver,
            "summary": summary
        }
    }


# Returns global feature importance from the XGBoost model; used for the dashboard overview panel
@router.get("/global-feature-importance")
def get_global_feature_importance():
    if model is None:
        raise HTTPException(503, "Model not available")

    importances = model.feature_importances_

    features = []
    for i, feature in enumerate(FEATURES):
        features.append({
            "feature": feature,
            "label": FEATURE_LABELS[feature],
            "importance": round(float(importances[i]), 4),
            "importance_pct": round(float(importances[i]) * 100, 1)
        })

    features.sort(key=lambda x: x["importance"], reverse=True)

    return {
        "model": "UHI XGBoost Regressor",
        "features": features,
        "interpretation": (
            "Higher importance means the feature contributes more to the model's "
            "LST predictions across all wards. NDVI and albedo are the primary "
            "actionable levers for intervention planning."
        )
    }
