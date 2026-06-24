from __future__ import annotations

import math
from typing import Dict, Any

# Demo logistic-regression-style model.
# You can retrain/export these coefficients with scripts/train_ml_model.py.
COEFFICIENTS = {
    "intercept": -2.2,
    "previous_missed": 1.1,
    "distance_km": 0.09,
    "late_before": 0.9,
    "parent_response_missing": 1.0,
    "health_record_count": 0.05,
    "review_required": 0.8,
}


def _sigmoid(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-value))


def predict_missed_vaccine_risk(features: Dict[str, Any]) -> Dict[str, Any]:
    """Predict missed-vaccine risk for demo purposes.

    This is not a medical model. It is a competition prototype showing how ML
    can prioritize follow-up. Real deployment would need validated data.
    """
    previous_missed = float(features.get("previous_missed", 0) or 0)
    distance_km = float(features.get("distance_km", 0) or 0)
    late_before = float(features.get("late_before", 0) or 0)
    parent_response_missing = float(features.get("parent_response_missing", 0) or 0)
    health_record_count = float(features.get("health_record_count", 0) or 0)
    review_required = float(features.get("review_required", 0) or 0)

    score = (
        COEFFICIENTS["intercept"]
        + COEFFICIENTS["previous_missed"] * previous_missed
        + COEFFICIENTS["distance_km"] * distance_km
        + COEFFICIENTS["late_before"] * late_before
        + COEFFICIENTS["parent_response_missing"] * parent_response_missing
        + COEFFICIENTS["health_record_count"] * health_record_count
        + COEFFICIENTS["review_required"] * review_required
    )
    probability = round(_sigmoid(score), 3)

    if probability >= 0.70:
        level = "high"
    elif probability >= 0.40:
        level = "medium"
    else:
        level = "low"

    return {
        "risk_level": level,
        "risk_probability": probability,
        "features_used": {
            "previous_missed": previous_missed,
            "distance_km": distance_km,
            "late_before": late_before,
            "parent_response_missing": parent_response_missing,
            "health_record_count": health_record_count,
            "review_required": review_required,
        },
    }
