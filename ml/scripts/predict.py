"""
Energy prediction service entry point used by the Node backend.

Reads a JSON file, produces a JSON output file:
    python ml/scripts/predict.py --input in.json --output out.json

Input format:
    {"records": [{room_id, building, room_type, hour, period, day_of_week,
                  occupancy, capacity, lights_on, fans_on, historical_energy}, ...]}

Output format:
    {"predictions": [{"room_id", "predicted_energy", "model_version", "confidence"}], "model_version", "feature_names"}
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
    "building", "room_type", "hour", "period", "day_of_week",
    "occupancy", "capacity", "lights_on", "fans_on", "historical_energy",
]


def load_pipeline():
    pipe_file = os.path.join(MODELS_DIR, "energy_pipeline.joblib")
    if not os.path.exists(pipe_file):
        raise FileNotFoundError("energy_pipeline.joblib missing. Run `python ml/scripts/train_model.py`.")
    return joblib.load(pipe_file)


def main():
    parser = argparse.ArgumentParser(description="Run energy predictions")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        payload = json.load(f)

    records = payload.get("records", payload if isinstance(payload, list) else [payload])
    if not isinstance(records, list):
        records = [records]

    pipe = load_pipeline()
    model = pipe.named_steps.get("model")
    model_version = "energy-v1"

    df = pd.DataFrame(records)
    for col in DEFAULT_FEATURES:
        if col not in df.columns:
            df[col] = 0

    X = df[DEFAULT_FEATURES]
    X = X.astype({c: "int64" for c in ["hour", "period", "day_of_week", "occupancy", "capacity", "lights_on", "fans_on"]})

    try:
        y_pred = pipe.predict(X)
    except Exception as e:
        # fallback: predict while converting unknowns to strings
        for c in ["building", "room_type"]:
            df[c] = df[c].astype(str)
        X = df[DEFAULT_FEATURES]
        y_pred = pipe.predict(X)
        print(f"[warn] native predict failed ({e}), used string fallback.")

    # confidence from tree disagreement (Random Forest)
    def confidence_for(x_sel):
        if hasattr(model, "estimators_"):
            per_tree = np.array([t.predict(x_sel) for t in model.estimators_])
            std = per_tree.std(axis=0)
            mean = np.abs(per_tree.mean(axis=0)) + 1e-6
            return np.clip(1 - std / mean, 0.0, 1.0)
        return np.full(len(x_sel), 1.0)

    conf = confidence_for(X)

    predictions = []
    for i, rec in enumerate(records):
        predictions.append({
            "room_id": rec.get("room_id", f"room-{i}"),
            "predicted_energy": round(max(0.0, float(y_pred[i])), 4),
            "model_version": model_version,
            "confidence": round(float(conf[i]), 4),
        })

    out = {
        "predictions": predictions,
        "model_version": model_version,
        "feature_count": int(len(DEFAULT_FEATURES)),
    }
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out, f)


if __name__ == "__main__":
    sys.exit(main())