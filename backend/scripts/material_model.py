import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import joblib  # For saving/loading the model
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
print("--- Loading Data ---")
try:
    materials_df = pd.read_csv('materials_dataset.csv')
    print("Materials dataset loaded successfully.")
except FileNotFoundError:
    print("Error: 'materials_dataset.csv' not found.")
    exit()


print("\n--- Preprocessing & Label Creation ---")
q33 = materials_df['Cooling_Index'].quantile(0.33)
q66 = materials_df['Cooling_Index'].quantile(0.66)

def assign_suitability(val):
    if val <= q33:
        return 'Low'
    elif val <= q66:
        return 'Medium'
    else:
        return 'High'

materials_df['Suitability_Zone'] = materials_df['Cooling_Index'].apply(assign_suitability)

# Define features (X) and Target (y)
feature_cols = [
    'Thermal_Conductivity_W_mK', 'Specific_Heat_kJ_kgK', 'Solar_Reflective_Index',
    'Embodied_Carbon_kgCO2_kg', 'Price_INR_per_m3', 'VOC_Rating',
    'Recycled_Content_percent', 'Source_Distance_KM', 'Local_Availability_1_10'
]

X = materials_df[feature_cols]
y = materials_df['Suitability_Zone']


print("\n--- Training Model ---")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
rf_model.fit(X_train, y_train)

print("Model Trained Successfully!")


print("\n--- Model Performance Evaluation ---")
y_pred = rf_model.predict(X_test)

# A. Numerical Metrics
print(f"Overall Accuracy: {accuracy_score(y_test, y_pred):.2%}")
print("\nDetailed Classification Report:")
print(classification_report(y_test, y_pred))

# B. Visualization: Confusion Matrix
cm = confusion_matrix(y_test, y_pred, labels=['High', 'Medium', 'Low'])
plt.figure(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=['High', 'Medium', 'Low'],
            yticklabels=['High', 'Medium', 'Low'])
plt.title('Confusion Matrix: Actual vs Predicted Zones')
plt.xlabel('Predicted')
plt.ylabel('Actual')
plt.show()

# C. Visualization: Feature Importance
importances = rf_model.feature_importances_
indices = np.argsort(importances)[::-1]
plt.figure(figsize=(10, 6))
plt.title("Feature Importance")
plt.bar(range(X.shape[1]), importances[indices], align="center")
plt.xticks(range(X.shape[1]), [X.columns[i] for i in indices], rotation=45, ha='right')
plt.tight_layout()
plt.show()


print("\n--- Exporting Model ---")
model_filename = 'climate_material_model.pkl'
joblib.dump(rf_model, model_filename)
print(f"Model saved successfully as '{model_filename}'")


print("\n--- Verifying Exported PKL File ---")
loaded_model = joblib.load(model_filename)
print("Model loaded successfully from disk.")

sample_input = X_test.iloc[0:1]
original_prediction = rf_model.predict(sample_input)[0]
loaded_prediction = loaded_model.predict(sample_input)[0]

print(f"Sample Input Features:\n{sample_input.to_string(index=False)}")
print(f"Original Model Prediction: {original_prediction}")
print(f"Loaded Model Prediction:   {loaded_prediction}")

if original_prediction == loaded_prediction:
    print("\nSUCCESS: The loaded model matches the original model.")
else:
    print("\nWARNING: Predictions do not match.")


print("\n--- Final Performance Evaluation (Loaded Model) ---")
y_loaded_pred = loaded_model.predict(X_test)

# A. Accuracy
loaded_accuracy = accuracy_score(y_test, y_loaded_pred)
print(f"Loaded Model Accuracy: {loaded_accuracy:.2%}")

# B. Classification Report
print("\nClassification Report (Loaded Model):")
print(classification_report(y_test, y_loaded_pred))

# C. Confusion Matrix
cm_loaded = confusion_matrix(y_test, y_loaded_pred, labels=['High', 'Medium', 'Low'])

plt.figure(figsize=(8, 6))
sns.heatmap(
    cm_loaded,
    annot=True,
    fmt='d',
    cmap='Blues',
    xticklabels=['High', 'Medium', 'Low'],
    yticklabels=['High', 'Medium', 'Low']
)
plt.title('Confusion Matrix (Loaded Model)')
plt.xlabel('Predicted')
plt.ylabel('Actual')
plt.tight_layout()
plt.show()
