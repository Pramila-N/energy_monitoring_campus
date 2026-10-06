"""
Evaluate the saved energy model on the held-out FINAL MONTH (one month of
unseen "future" data after ~3 months of training data) and write actual-vs-
predicted predictions to ml/models/test_predictions.csv for the faculty demo.

Run:  python ml/scripts/evaluate_model.py [--test-days 28]
"""
import argparse
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_FILE = os.path.join(ROOT, "ml", "data", "training_data.csv")
MODELS_DIR = os.path.join(ROOT, "ml", "models")

TEST_DAYS = 28


def metrics_dict(y_true, y_pred):
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    mae = mean_absolute_error(y_true, y_pred)
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    r2 = r2_score(y_true, y_pred)
    mask = y_true > 0.05
    mape = float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100) if mask.sum() else float("nan")
    return {"mae": round(mae, 4), "rmse": round(rmse, 4), "r2": round(r2, 4), "mape": round(mape, 2)}


def held_out_split(df, test_days):
    maxd = df.groupby("room_id")["day_index"].transform("max")
    mask = (maxd - df["day_index"]) < test_days
    return df[~mask], df[mask]


def main():
    parser = argparse.ArgumentParser(description="Evaluate the saved energy model on the held-out future month")
    parser.add_argument("--test-days", type=int, default=TEST_DAYS, help="calendar days held out as the future test month")
    args = parser.parse_args()
    test_days = args.test_days

    pipe_file = os.path.join(MODELS_DIR, "energy_pipeline.joblib")
    if not os.path.exists(pipe_file):
        print("Model not found. Run `python ml/scripts/train_model.py` first.")
        sys.exit(1)

    meta = json.load(open(os.path.join(MODELS_DIR, "features.json")))
    features = meta["features"]
    target = meta["target"]

    df = pd.read_csv(DATA_FILE).dropna(subset=features + [target])
    if "day_index" not in df.columns:
        print("day_index column missing — regenerate data with generate_data.py (default 119 days).")
        sys.exit(1)

    train_df, test_df = held_out_split(df, test_days)
    X_test, y_test = test_df[features], test_df[target]

    pipe = joblib.load(pipe_file)
    y_pred = pipe.predict(X_test)
    m = metrics_dict(y_test, y_pred)

    print("=== Saved Energy Model Evaluation (held-out future month) ===")
    print(f"Model: {meta.get('model_version', 'energy-v1')} ({meta.get('model', 'sklearn')})")
    print(f"Test month rows: {len(test_df)}  (train rows: {len(train_df)})")
    print(f"R² Score: {m['r2']:.4f}")
    print(f"MAE: {m['mae']:.4f} kWh")
    print(f"RMSE: {m['rmse']:.4f} kWh")
    print(f"MAPE: {m['mape']:.2f}%")

    test_out = test_df[["room_id", "date", "hour", "period", "day_of_week", "building", "room_type", "occupancy", "lights_on", "fans_on", "historical_energy"]].copy()
    test_out["actual_energy"] = y_test.values
    test_out["predicted_energy"] = np.round(y_pred, 3)
    test_out["error_kwh"] = np.round(y_test.values - y_pred, 3)
    test_out.to_csv(os.path.join(MODELS_DIR, "test_predictions.csv"), index=False)
    print(f"Actual-vs-predicted written to ml/models/test_predictions.csv")

    with open(os.path.join(MODELS_DIR, "metrics.json"), "r") as f:
        saved = json.load(f)
    saved["metrics"] = m
    saved["split"] = {
        "strategy": "chronological held-out final month (future data)",
        "test_days": test_days,
        "train_rows": int(len(train_df)),
        "test_rows": int(len(test_df)),
    }
    with open(os.path.join(MODELS_DIR, "metrics.json"), "w") as f:
        json.dump(saved, f, indent=2)


if __name__ == "__main__":
    sys.exit(main())