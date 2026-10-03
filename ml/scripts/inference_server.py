"""
Persistent ML inference server used by the Node backend.

Loads both models once, then serves prediction requests over line-delimited JSON
on stdin/stdout. Requests:

    {"id": 1, "op": "ping"}
    {"id": 2, "op": "energy", "records": [...]}
    {"id": 3, "op": "occupancy", "records": [...]}
    {"id": 4, "op": "all", "records": [...]}   # occupancy -> energy in one call

Responses are written back as one JSON line per request.
Outputs "READY" once models are loaded.
"""
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(ROOT, "ml", "models")

ENERGY_FEATURES = [
    "building", "room_type", "hour", "period", "day_of_week",
    "occupancy", "capacity", "lights_on", "fans_on", "historical_energy",
]
OCCUPANCY_FEATURES = [
    "day_of_week", "period", "expected_occupancy", "capacity",
    "room_type", "building", "faculty_avg_attendance",
]

_energy_pipe = None
_occupancy_pipe = None


def load_models():
    global _energy_pipe, _occupancy_pipe
    if _energy_pipe is None:
        _energy_pipe = joblib.load(os.path.join(MODELS_DIR, "energy_pipeline.joblib"))
    if _occupancy_pipe is None:
        _occupancy_pipe = joblib.load(os.path.join(MODELS_DIR, "occupancy_pipeline.joblib"))
    return _energy_pipe, _occupancy_pipe


def _int_cols(df, cols):
    for c in cols:
        if c in df.columns:
            df[c] = df[c].astype("int64")


def predict_energy(records, present_map=None):
    df = pd.DataFrame(records)
    for c in ENERGY_FEATURES:
        if c not in df.columns:
            df[c] = 0
    if present_map is not None:
        present = [present_map.get(r.get("room_id"), r.get("occupancy", 0)) for r in records]
        df["occupancy"] = present

    _int_cols(df, ["hour", "period", "day_of_week", "occupancy", "capacity", "lights_on", "fans_on"])
    pipe, _ = load_models()
    try:
        y_pred = pipe.predict(df[ENERGY_FEATURES])
    except Exception:
        for c in ["building", "room_type"]:
            df[c] = df[c].astype(str)
        y_pred = pipe.predict(df[ENERGY_FEATURES])

    model = pipe.named_steps.get("model")
    if hasattr(model, "estimators_"):
        per_tree = np.array([t.predict(df[ENERGY_FEATURES]) for t in model.estimators_])
        std = per_tree.std(axis=0)
        mean = np.abs(per_tree.mean(axis=0)) + 1e-6
        conf = np.clip(1 - std / mean, 0.0, 1.0)
    else:
        conf = np.ones(len(df))

    out = []
    for i, rec in enumerate(records):
        out.append({
            "room_id": rec.get("room_id", f"room-{i}"),
            "predicted_energy": round(max(0.0, float(y_pred[i])), 4),
            "model_version": "energy-v1",
            "confidence": round(float(conf[i]), 4),
        })
    return out


def predict_occupancy(records):
    df = pd.DataFrame(records)
    for c in OCCUPANCY_FEATURES:
        if c not in df.columns:
            df[c] = 0
    _int_cols(df, ["day_of_week", "period", "expected_occupancy", "capacity"])
    df["faculty_avg_attendance"] = pd.to_numeric(df["faculty_avg_attendance"], errors="coerce").fillna(0).astype("float")

    _, pipe = load_models()
    try:
        rates = pipe.predict(df[OCCUPANCY_FEATURES])
    except Exception:
        for c in ["room_type", "building"]:
            df[c] = df[c].astype(str)
        rates = pipe.predict(df[OCCUPANCY_FEATURES])

    outf = []
    for i, rec in enumerate(records):
        expected = int(rec.get("expected_occupancy", 0) or 0)
        capacity = int(rec.get("capacity", 0) or 0)
        rate = float(np.clip(rates[i], 0.0, 1.0))
        present = 0 if expected <= 0 else min(capacity, int(round(expected * rate)))
        outf.append({
            "room_id": rec.get("room_id", f"room-{i}"),
            "predicted_present": present,
            "attendance_probability": round(rate, 4),
        })
    return outf


def handle_request(msg):
    op = msg.get("op")
    records = msg.get("records") or []
    if op == "ping":
        return {"ok": True}
    if op == "occupancy":
        return {"predictions": predict_occupancy(records), "model_version": "occupancy-v1"}
    if op == "energy":
        return {"predictions": predict_energy(records), "model_version": "energy-v1"}
    if op == "all":
        occ = predict_occupancy(records)
        present_map = {p["room_id"]: p["predicted_present"] for p in occ}
        return {
            "occupancy": {"predictions": occ, "model_version": "occupancy-v1"},
            "energy": {"predictions": predict_energy(records, present_map), "model_version": "energy-v1"},
        }
    return {"error": f"unknown op: {op}"}


def main():
    load_models()
    print("READY", flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        msg_id = None
        try:
            msg = json.loads(line)
            msg_id = msg.get("id")
            result = handle_request(msg)
        except Exception as e:  # noqa: BLE001
            result = {"error": str(e)}
        if msg_id is not None:
            result["id"] = msg_id
        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass