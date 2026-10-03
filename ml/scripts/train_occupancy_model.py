"""
Train the Occupancy Prediction Model.

Separate from the energy model. Predicts how many students are likely to be
present (attendance rate) from expected occupancy, room/faculty history and
time features.

Outputs in ml/models:
    occupancy_pipeline.joblib, occupancy_model.joblib,
    occupancy_metrics.json, occupancy_features.json

Run:  python ml/scripts/train_occupancy_model.py
"""
import argparse
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_FILE = os.path.join(ROOT, "ml", "data", "occupancy_training_data.csv")
MODELS_DIR = os.path.join(ROOT, "ml", "models")

FEATURES = [
    "day_of_week", "period", "expected_occupancy", "capacity",
    "room_type", "building", "faculty_avg_attendance",
]
CATEGORICAL = ["room_type", "building"]
TARGET = "actual_attendance_rate"
MODEL_VERSION = "occupancy-v1"


def build_pipeline(model):
    cat = list(CATEGORICAL)
    num = [f for f in FEATURES if f not in cat]
    pre = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), cat),
            ("num", "passthrough", num),
        ]
    )
    return Pipeline([("pre", pre), ("model", model)])


def main():
    parser = argparse.ArgumentParser(description="Train and save the occupancy prediction model")
    parser.add_argument("--data", default=DATA_FILE)
    args = parser.parse_args()

    if not os.path.exists(args.data):
        print("occupancy_training_data.csv not found. Run `python ml/scripts/generate_data.py` first.")
        sys.exit(1)

    print("Training Occupancy Prediction Model...\n")
    df = pd.read_csv(args.data)
    print(f"Loaded {len(df)} rows from {args.data}")

    df = df.dropna(subset=FEATURES + [TARGET]).copy()
    df = df[df[TARGET] >= 0]

    X = df[FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestRegressor(n_estimators=250, random_state=42, n_jobs=-1)
    pipe = build_pipeline(model)
    pipe.fit(X_train, y_train)

    y_pred = pipe.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    rmse = float(np.sqrt(np.mean((y_test - y_pred) ** 2)))

    print(f"Random Forest Regressor    R2: {r2:.4f}   MAE: {mae:.4f}   RMSE: {rmse:.4f}")

    os.makedirs(MODELS_DIR, exist_ok=True)
    joblib.dump(pipe, os.path.join(MODELS_DIR, "occupancy_pipeline.joblib"))
    joblib.dump(model, os.path.join(MODELS_DIR, "occupancy_model.joblib"))

    meta = {
        "model": "Random Forest Regressor",
        "model_version": MODEL_VERSION,
        "metrics": {
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "r2": round(r2, 4),
        },
        "features": FEATURES,
        "categorical": CATEGORICAL,
        "target": TARGET,
    }
    with open(os.path.join(MODELS_DIR, "occupancy_metrics.json"), "w") as f:
        json.dump(meta, f, indent=2)
    with open(os.path.join(MODELS_DIR, "occupancy_features.json"), "w") as f:
        json.dump({"features": FEATURES, "categorical": CATEGORICAL, "target": TARGET}, f, indent=2)

    print("\nOccupancy model saved successfully.")


if __name__ == "__main__":
    sys.exit(main())