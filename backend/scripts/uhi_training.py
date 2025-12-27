import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error
from xgboost import XGBRegressor
import joblib


df = pd.read_csv("/content/blr_uhi_ml_dataset.csv")

print("Original rows:", len(df))

df = df.dropna(subset=["lst", "ndvi", "albedo", "lon", "lat"])

# Physical bounds
df = df[(df["lst"] > 5) & (df["lst"] < 70)]
df = df[(df["ndvi"] >= 0) & (df["ndvi"] <= 1)]
df = df[(df["albedo"] >= 0) & (df["albedo"] <= 1)]

print("Clean rows:", len(df))

# Feature Matrix
FEATURES = ["ndvi", "albedo", "lon", "lat"]

X = df[FEATURES]
y = df["lst"]

# Train/Test Split
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42
)

# XGBoost (with monotonicity)
model = XGBRegressor(
    n_estimators=500,
    max_depth=8,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,

    monotone_constraints=(-1, -1, 0, 0),

    objective="reg:squarederror",
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)

y_pred = model.predict(X_test)

# performance metrics
print("\nModel Performance")
print("R² Score:", round(r2_score(y_test, y_pred), 4))
print("MAE (°C):", round(mean_absolute_error(y_test, y_pred), 3))

# Feature Importance
importance = model.feature_importances_

imp_df = pd.DataFrame({
    "feature": FEATURES,
    "importance": importance
}).sort_values("importance", ascending=False)

print("\nFeature Importance")
print(imp_df)

joblib.dump(model, "uhi_xgb_monotonic_model.pkl")