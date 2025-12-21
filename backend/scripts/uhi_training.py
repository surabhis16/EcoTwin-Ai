import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error

# load and clean data
df = pd.read_csv("/content/ml_lst_ndvi_sample.csv")

df = (
    df.dropna(subset=["lst", "ndvi", "lon", "lat"])
      .query("lst > 0")
      .query("0 <= ndvi <= 1")
)

print(f"Final dataset size: {len(df)}")


# train Model (RF)
X = df["ndvi", "lon", "lat"]
y = df["lst"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestRegressor(
    n_estimators=300,
    max_depth=20,
    min_samples_leaf=5,
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)


# evaluate model
y_pred = model.predict(X_test)

print(f"R² Score: {r2_score(y_test, y_pred):.3f}")
print(f"MAE (°C): {mean_absolute_error(y_test, y_pred):.2f}")


# save Model
joblib.dump(model, "green_cover_rf_model.pkl")


# Feature Importance
importance_df = pd.DataFrame({
    "feature": ["ndvi", "lon", "lat"],
    "importance": model.feature_importances_
}).sort_values("importance", ascending=False)

print("\nFeature importance:")
print(importance_df)


# Green Cover Impact Simulation
X_before = df["ndvi", "lon", "lat"]
lst_before = model.predict(X_before)

df_sim = df.copy()
df_sim["ndvi"] = (df_sim["ndvi"] + 0.2).clip(0, 1)

X_after = df_sim["ndvi", "lon", "lat"]
# predict the lst after green cover increase
lst_after = model.predict(X_after)

df["lst_before"] = lst_before
df["lst_after"] = lst_after
df["cooling"] = lst_before - lst_after

# save the results in csv
df.to_csv("/content/green_cover_impact.csv", index=False)

print(f"\nSimulation results saved")
