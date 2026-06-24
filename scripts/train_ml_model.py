"""Optional training script for the VaxID missed-vaccine ML idea.

Run locally:
    python -m venv venv
    venv\\Scripts\\activate   # Windows
    pip install pandas scikit-learn
    python scripts/train_ml_model.py

For the competition demo, functions/risk_model.py already contains a lightweight
logistic-regression-style predictor. This script shows how you could train a real
model later with real approved data.
"""

from pathlib import Path
import json

import pandas as pd
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "functions" / "trained_model_coefficients.json"

training_data = pd.DataFrame({
    "previous_missed": [0, 1, 2, 0, 3, 1, 0, 2, 1, 3, 4, 0],
    "distance_km": [1, 5, 8, 2, 12, 6, 1, 10, 4, 15, 20, 3],
    "late_before": [0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0],
    "parent_response_missing": [0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0],
    "health_record_count": [0, 1, 2, 0, 4, 1, 0, 3, 1, 5, 4, 0],
    "review_required": [0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0],
    "missed_next": [0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0],
})

features = [
    "previous_missed",
    "distance_km",
    "late_before",
    "parent_response_missing",
    "health_record_count",
    "review_required",
]

X = training_data[features]
y = training_data["missed_next"]

model = LogisticRegression()
model.fit(X, y)

export = {
    "features": features,
    "intercept": float(model.intercept_[0]),
    "coefficients": {name: float(value) for name, value in zip(features, model.coef_[0])},
}

OUT.write_text(json.dumps(export, indent=2), encoding="utf-8")
print(f"Saved coefficients to {OUT}")
