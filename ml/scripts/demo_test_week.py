"""
Faculty demo helper: prints a table of ACTUAL vs PREDICTED energy for the
held-out TEST PERIOD — by default one month of data the model never saw
during training (the "future" it is asked to forecast).

Run after training/evaluation:
    python ml/scripts/demo_test_week.py
"""
import argparse
import json
import os
import sys

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(ROOT, "ml", "models")

CSV_FILE = os.path.join(MODELS_DIR, "test_predictions.csv")
METRICS_FILE = os.path.join(MODELS_DIR, "metrics.json")


def period_label():
    """'MONTH' when the held-out split is >= 28 days, otherwise 'WEEK'."""
    try:
        meta = json.load(open(METRICS_FILE))
        days = meta.get("split", {}).get("test_days", 28)
        return "MONTH" if days >= 28 else "WEEK"
    except Exception:
        return "MONTH"


def main():
    parser = argparse.ArgumentParser(description="Print actual vs predicted energy for the held-out test period")
    parser.add_argument("--csv", default=CSV_FILE)
    args = parser.parse_args()

    if not os.path.exists(args.csv):
        print("test_predictions.csv not found. Run `python ml/scripts/evaluate_model.py` first.")
        sys.exit(1)

    label = period_label()
    df = pd.read_csv(args.csv)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["room_id", "date", "period"]).reset_index(drop=True)
    df["date_str"] = df["date"].dt.strftime("%b %d")

    print("=" * 74)
    print(f"HELD-OUT TEST {label} — AI vs ACTUAL energy consumption (unseen future data)")
    print("=" * 74)

    print(f"\nTotal test samples: {len(df)} across {df['room_id'].nunique()} rooms.")
    print("\nFirst 18 samples (actual meter value vs AI forecast):\n")
    head = df.head(18)
    print(f"{'Room':<8}{'Date':<8}{'Per':<5}{'Actual kWh':<12}{'AI kWh':<11}{'Err':<8}")
    for _, r in head.iterrows():
        print(f"{r['room_id']:<8}{r['date_str']:<8}{r['period']:<5}{r['actual_energy']:<12.3f}{r['predicted_energy']:<11.3f}{r['error_kwh']:<8.3f}")

    # Overall error stats on the held-out period
    err = (df["actual_energy"] - df["predicted_energy"]).abs()
    signed = df["actual_energy"] - df["predicted_energy"]
    mae = float(err.mean())
    rmse = float(((signed ** 2).mean() ** 0.5))
    r2 = 1 - float(((signed ** 2).sum()) / (((df["actual_energy"] - df["actual_energy"].mean()) ** 2).sum() + 1e-12))
    mask = df["actual_energy"] > 0.05
    mape = float(((signed[mask].abs() / df.loc[mask, "actual_energy"]).mean()) * 100)

    print("\n" + "-" * 74)
    print(f"Held-out {label.lower()} performance (this is how the model generalises to NEW data):")
    print(f"  R²    = {r2:.4f}   (1.0 = perfect forecast)")
    print(f"  MAE   = {mae:.4f} kWh per room per 30-min slot")
    print(f"  RMSE  = {rmse:.4f} kWh")
    print(f"  MAPE  = {mape:.2f}%")

    if os.path.exists(METRICS_FILE):
        meta = json.load(open(METRICS_FILE))
        m = meta.get("metrics", {})
        tr = meta.get("train_metrics", {})
        print(f"\nSaved model: train R²={tr.get('r2')}, test-{label.lower()} R²={m.get('r2')} (model={meta.get('model')})")
    print("\nFull table: ml/models/test_predictions.csv")


if __name__ == "__main__":
    sys.exit(main())