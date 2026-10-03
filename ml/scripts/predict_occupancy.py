"""
Occupancy prediction service entry point used by the Node backend.

Estimates how many students are likely to be present for a batch of rooms.

    python ml/scripts/predict_occupancy.py --input in.json --output out.json

Input format:
    {"records": [{room_id, building, room_type, day_of_week, period,
                  expected_occupancy, capacity, faculty_avg_attendance}, ...]}

Output format:
    {"predictions": [{"room_id", "predicted_present", "attendance_probability"}], "model_version"}
"""
import argparse
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(ROOT, "ml", "models")

DEFAULT_FEATURES = [
    "day_of_week", "period", "expected_occupancy", "capacity",
    "room_type", "building", "faculty_avg_attendance",
]


def load_pipeline():
    pipe_file = os.path.join(MODELS_DIR, "occupancy_pipeline.joblib")
    if not os.path.exists(pipe_file):
        raise FileNotFoundError("occupancy_pipeline.joblib missing. Run `python ml/scripts/train_occupancy_model.py`.")
    return joblib.load(pipe_file)


def main():
    parser = argparse.ArgumentParser(description="Run occupancy predictions")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        payload = json.load(f)

    records = payload.get("records", payload if isinstance(payload, list) else [payload])
    if not isinstance(records, list):
        records = [records]

    pipe = load_pipeline()
    df = pd.DataFrame(records)
    for col in DEFAULT_FEATURES:
        if col not in df.columns:
            df[col] = 0

    X = df[DEFAULT_FEATURES]
    X = X.astype({c: "int64" for c in ["day_of_week", "period", "expected_occupancy", "capacity", "faculty_avg_attendance"]})

    try:
        rates = pipe.predict(X)
    except Exception:
        for c in ["room_type", "building"]:
            df[c] = df[c].astype(str)
        rates = pipe.predict(df[DEFAULT_FEATURES])

    predictions = []
    for i, rec in enumerate(records):
        expected = int(rec.get("expected_occupancy", 0) or 0)
        capacity = int(rec.get("capacity", 0) or 0)
        rate = float(np.clip(rates[i], 0.0, 1.0))
        present = 0 if expected <= 0 else min(capacity, int(round(expected * rate)))
        predictions.append({
            "room_id": rec.get("room_id", f"room-{i}"),
            "predicted_present": present,
            "attendance_probability": round(rate, 4),
        })

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump({"predictions": predictions, "model_version": "occupancy-v1"}, f)


if __name__ == "__main__":
    sys.exit(main())