"""
Faculty demo helper: prints a table of ACTUAL vs PREDICTED energy for the
held-out TEST WEEK (one week of data the model never saw during training).

Run after training/evaluation:
    python ml/scripts/demo_test_week.py
"""
import json
import os
import sys

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(ROOT, "ml", "models")

CSV_FILE = os.path.join(MODELS_DIR, "test_predictions.csv")
METRICS_FILE = os.path.join(MODELS_DIR, "metrics.json")


def main():
    if not os.path.exists(CSV_FILE):
        print("test_predictions.csv not found. Run `python ml/scripts/evaluate_model.py` first.")
        sys.exit(1)

    df = pd.read_csv(CSV_FILE)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["room_id", "date", "period"]).reset_index(drop=True)
    df["date_str"] = df["date"].dt.strftime("%b %d")

    print("=" * 74)
    print("HELD-OUT TEST WEEK — AI vs ACTUAL energy consumption (unseen data)")
    print("=" * 74)

    print(f"\nTotal test samples: {len(df)} across {df['room_id'].nunique()} rooms.")
    print("\nFirst 18 samples (actual meter value vs AI forecast):\n")
    head = df.head(18)
    print(f"{'Room':<8}{'Date':<8}{'Per':<5}{'Actual kWh':<12}{'AI kWh':<11}{'Err':<8}")
    for _, r in head.iterrows():
        print(f"{r['room_id']:<8}{r['date_str']:<8}{r['period']:<5}{r['actual_energy']:<12.3f}{r['predicted_energy']:<11.3f}{r['error_kwh']:<8.3f}")

    # Overall error stats on the held-out week
    err = (df["actual_energy"] - df["predicted_energy"]).abs()
    signed = df["actual_energy"] - df["predicted_energy"]
    mae = float(err.mean())
    rmse = float(((signed ** 2).mean() ** 0.5))
    r2 = 1 - float(((signed ** 2).sum()) / (((df["actual_energy"] - df["actual_energy"].mean()) ** 2).sum() + 1e-12))
    mask = df["actual_energy"] > 0.05
    mape = float(((signed[mask].abs() / df.loc[mask, "actual_energy"]).mean()) * 100)

    print("\n" + "-" * 74)
    print("Held-out week performance (this is how the model generalises to NEW data):")
    print(f"  R²    = {r2:.4f}   (1.0 = perfect forecast)")
    print(f"  MAE   = {mae:.4f} kWh per room per 30-min slot")
    print(f"  RMSE  = {rmse:.4f} kWh")
    print(f"  MAPE  = {mape:.2f}%")

    if os.path.exists(METRICS_FILE):
        meta = json.load(open(METRICS_FILE))
        m = meta.get("metrics", {})
        tr = meta.get("train_metrics", {})
        print(f"\nSaved model: train R²={tr.get('r2')}, test-week R²={m.get('r2')} (model={meta.get('model')})")
    print("\nFull table: ml/models/test_predictions.csv")


if __name__ == "__main__":
    sys.exit(main())