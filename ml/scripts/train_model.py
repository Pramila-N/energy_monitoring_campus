"""
Train the Energy Prediction Model.

Pipeline:
    1. Load ml/data/training_data.csv (~2 months of synthetic meter data)
    2. Validate + preprocess (categorical encoding via OneHot, no scaling for RF)
    3. Chronological split: train on the first ~2 months, TEST on the FINAL
       held-out week (no random shuffling — mirrors real forecasting).
    4. Compare Linear Regression / Decision Tree / Random Forest
    5. Select best model by R² on the held-out week
    6. Save model + preprocessing pipeline + features + metrics + test predictions

Run from project root:  python ml/scripts/train_model.py
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
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeRegressor

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_FILE = os.path.join(ROOT, "ml", "data", "training_data.csv")
MODELS_DIR = os.path.join(ROOT, "ml", "models")

FEATURES = [
    "building", "room_type", "hour", "period", "day_of_week",
    "occupancy", "capacity", "lights_on", "fans_on", "historical_energy",
]
CATEGORICAL = ["building", "room_type"]
TARGET = "actual_energy"

MODEL_VERSION = "energy-v1"
TEST_DAYS = 7  # the final 7 calendar days of history become the held-out week


def metrics_dict(y_true, y_pred):
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    mae = mean_absolute_error(y_true, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = r2_score(y_true, y_pred)
    mask = y_true > 0.05
    mape = float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100) if mask.sum() else float("nan")
    return {"mae": round(mae, 4), "rmse": round(rmse, 4), "r2": round(r2, 4), "mape": round(mape, 2)}


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


def held_out_split(df):
    """Rows of each room are chronological; the last TEST_DAYS calendar days
    of every room form the held-out test set (the 'final week')."""
    maxd = df.groupby("room_id")["day_index"].transform("max")
    mask = (maxd - df["day_index"]) < TEST_DAYS
    train = df[~mask]
    test = df[mask]
    return train, test


def main():
    parser = argparse.ArgumentParser(description="Train and save the energy prediction model")
    parser.add_argument("--data", default=DATA_FILE)
    parser.add_argument("--no-save", action="store_true", help="only evaluate, do not overwrite saved artefacts")
    args = parser.parse_args()

    if not os.path.exists(args.data):
        print("training_data.csv not found. Run `python ml/scripts/generate_data.py` first.")
        sys.exit(1)

    print("Training Energy Prediction Model...\n")
    df = pd.read_csv(args.data)
    print(f"Loaded {len(df)} rows from {args.data}")

    missing = [c for c in FEATURES if c not in df.columns]
    if missing:
        print(f"Missing columns: {missing}")
        sys.exit(1)
    if TARGET not in df.columns:
        print(f"Missing target column: {TARGET}")
        sys.exit(1)

    df = df.dropna(subset=FEATURES + [TARGET]).copy()
    df = df[df[TARGET] >= 0]

    if "day_index" not in df.columns:
        print("day_index column missing — regenerate data with generate_data.py (default 91 days).")
        sys.exit(1)

    train_df, test_df = held_out_split(df)
    X_train, y_train = train_df[FEATURES], train_df[TARGET]
    X_test, y_test = test_df[FEATURES], test_df[TARGET]
    print(f"Chronological split: train = last {len(train_df)} rows (~2 months) | test = final held-out week = {len(test_df)} rows\n")

    best = None
    results = {}
    figures = [
        ("Linear Regression", LinearRegression(), {}),
        ("Decision Tree", DecisionTreeRegressor(max_depth=8, random_state=42), {}),
        ("Random Forest", RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1), {}),
    ]

    for name, model, _ in figures:
        pipe = build_pipeline(model)
        pipe.fit(X_train, y_train)
        y_pred = pipe.predict(X_test)
        m = metrics_dict(y_test, y_pred)
        results[name] = m
        r2 = m["r2"]
        print(f"{name:<18} R2: {r2:.4f}   MAE: {m['mae']} kWh   RMSE: {m['rmse']} kWh   MAPE: {m['mape']}%")
        if best is None or r2 > best[1]["r2"]:
            best = (name, m, pipe)

    print(f"\nBest Model: {best[0]} (evaluated on the held-out week)")

    y_test_pred = best[2].predict(X_test)
    y_train_pred = best[2].predict(X_train)
    train_metrics = metrics_dict(y_train, y_train_pred)

    if args.no_save:
        print("\nSkipped saving (--no-save).")
        return

    os.makedirs(MODELS_DIR, exist_ok=True)

    joblib.dump(best[2], os.path.join(MODELS_DIR, "energy_pipeline.joblib"))
    joblib.dump(best[2].named_steps["model"], os.path.join(MODELS_DIR, "energy_model.joblib"))

    # Held-out week predictions file (actual vs predicted) for the faculty demo.
    test_out = test_df[["room_id", "date", "hour", "period", "day_of_week", "building", "room_type", "occupancy", "lights_on", "fans_on", "historical_energy"]].copy()
    test_out["actual_energy"] = y_test.values
    test_out["predicted_energy"] = np.round(y_test_pred, 3)
    test_out["error_kwh"] = np.round(y_test.values - y_test_pred, 3)
    test_out.to_csv(os.path.join(MODELS_DIR, "test_predictions.csv"), index=False)

    meta = {
        "model": best[0],
        "model_version": MODEL_VERSION,
        "metrics": best[1],                  # evaluated on the held-out test week
        "train_metrics": train_metrics,
        "comparison": results,
        "features": FEATURES,
        "categorical": CATEGORICAL,
        "target": TARGET,
        "split": {
            "strategy": "chronological held-out final week",
            "test_days": TEST_DAYS,
            "train_rows": int(len(train_df)),
            "test_rows": int(len(test_df)),
        },
    }
    with open(os.path.join(MODELS_DIR, "metrics.json"), "w") as f:
        json.dump(meta, f, indent=2)
    with open(os.path.join(MODELS_DIR, "features.json"), "w") as f:
        json.dump({"features": FEATURES, "categorical": CATEGORICAL, "target": TARGET}, f, indent=2)

    print("\nModel saved successfully.")
    print("  energy_model.joblib   (trained estimator)")
    print("  energy_pipeline.joblib (preprocessing + estimator)")
    print("  metrics.json / features.json / test_predictions.csv (held-out week)")


if __name__ == "__main__":
    sys.exit(main())