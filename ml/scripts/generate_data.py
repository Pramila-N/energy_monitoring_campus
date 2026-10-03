"""
Generate realistic synthetic training data for the Smart Energy system.

The room/environment definitions are parsed from backend/mock-data so the
synthetic energy follows the same physical model the backend simulation uses
(single source of truth). The data includes normal and abnormal examples so the
anomaly-detection demo has realistic variance.

Outputs:
    ml/data/training_data.csv              (energy model)
    ml/data/occupancy_training_data.csv    (occupancy model)

Each row also carries an artificial calendar date + day_index so training can
hold out the FINAL week chronologically (one week of unseen test data after
~2 months of training data) — exactly the demo shown to faculty.
"""
import argparse
import math
import os
import random
import re
import sys
from datetime import date as _Date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(ROOT, "ml", "data")
BACKEND_MOCK = os.path.join(ROOT, "backend", "mock-data")

START_DATE = _Date(2026, 1, 5)  # synthetic calendar anchor (a Monday)
LIGHT_DRAW_KW = 0.014
FAN_DRAW_KW = 0.02

ENERGY_PROFILES = {
    "classroom":       {"equipment": 0.2, "occ_scale": 1.6, "idle": 0.25},
    "seminar_hall":    {"equipment": 0.8, "occ_scale": 1.8, "idle": 0.20},
    "computer_lab":    {"equipment": 1.2, "occ_scale": 1.3, "idle": 0.35},
    "physics_lab":     {"equipment": 1.0, "occ_scale": 1.2, "idle": 0.40},
    "chemistry_lab":   {"equipment": 1.1, "occ_scale": 1.2, "idle": 0.45},
    "electronics_lab": {"equipment": 1.0, "occ_scale": 1.2, "idle": 0.40},
    "staff_room":      {"equipment": 0.4, "occ_scale": 0.8, "idle": 0.50},
}

DAY_EFFECT = {1: 1.0, 2: 1.02, 3: 0.98, 4: 0.96, 5: 0.90, 6: 0.70, 0: 0.40}
PERIOD_EFFECT = {1: 1.0, 2: 1.0, 3: 0.99, 4: 0.94, 5: 0.88, 6: 0.80, 7: 0.72, 8: 0.65}


def js_hash(s):
    """Replica of the JS hashString used by backend/mock-data/occupancy.js"""
    h = 7
    for ch in s:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    return abs(h)


def attendance_factor(room_number):
    return 0.55 + (js_hash(room_number) % 40) / 100.0


def parse_rooms_js():
    """Parse backend/mock-data/rooms.js to keep room definitions in one place."""
    file = os.path.join(BACKEND_MOCK, "rooms.js")
    with open(file, "r", encoding="utf-8") as f:
        text = f.read()
    blocks = re.findall(r"\{\s*([^{}]+?)\s*\}", text)
    rooms = []
    for b in blocks:
        def g(key):
            m = re.search(key + r"\s*:\s*['\"]?([^,'\"}\s]+)", b)
            return m.group(1) if m else None

        def gi(key, default):
            v = g(key)
            try:
                return int(v) if v is not None else default
            except ValueError:
                return default

        rn = g("roomNumber")
        if not rn:
            continue
        rooms.append({
            "roomNumber": rn,
            "building": g("buildingCode"),
            "type": g("type"),
            "capacity": gi("capacity", 40),
            "numLights": gi("numLights", 8),
            "numFans": gi("numFans", 4),
        })
    return rooms


def period_plan(room_number, rng, is_lab):
    """Deterministic-ish occupied periods per day for a room."""
    for day in range(1, 6):
        count = (2 + rng.randint(0, 3)) if is_lab else (3 + rng.randint(0, 5))
        available = list(range(1, 9))
        rng.shuffle(available)
        yield day, sorted(available[:count])


def room_draw(room, occupancy, lights_on, fans_on):
    prof = ENERGY_PROFILES.get(room["type"], ENERGY_PROFILES["classroom"])
    occ_factor = min(1.0, max(0.0, occupancy / room["capacity"])) if room["capacity"] else 0
    lights = room["numLights"] * LIGHT_DRAW_KW if lights_on else 0
    fans = room["numFans"] * FAN_DRAW_KW if fans_on else 0
    if occupancy <= 0:
        return prof["equipment"] * prof["idle"] + lights + fans
    return prof["equipment"] + occ_factor * prof["occ_scale"] + lights + fans


def actual_attendance_rate(room_number, dow, period, rng):
    rate = attendance_factor(room_number) * DAY_EFFECT.get(dow, 0.9) * PERIOD_EFFECT.get(period, 0.85)
    rate *= 1 + (rng.random() - 0.5) * 0.16
    if rng.random() < 0.02:
        return 0.0  # occasional class cancellation / nobody attended
    return max(0.15, min(1.0, rate))


def generate_energy_data(rooms, week_index, seed, start_date):
    rng = random.Random(seed)
    rows = []
    for room in rooms:
        is_lab = room["type"] in ("computer_lab", "physics_lab", "chemistry_lab", "electronics_lab")
        expected_rate = 0.5 + rng.random() * 0.45
        prev_energy = 0.0
        chronological = []
        for day, periods in period_plan(room["roomNumber"], rng, is_lab):
            day_offset = week_index * 7 + day - 1
            date_str = (start_date + timedelta(days=day_offset)).isoformat()
            for period in periods:
                expected = round(room["capacity"] * expected_rate * (0.9 + (rng.random() - 0.5) * 0.2))
                present = round(expected * actual_attendance_rate(room["roomNumber"], day, period, rng))
                lights_on = 1 if present > 0 else (1 if rng.random() < 0.06 else 0)
                fans_on = 1 if present > 0 else (1 if rng.random() < 0.04 else 0)
                draw = room_draw(room, present, lights_on, fans_on)
                if rng.random() < 0.04:
                    draw *= 1.45 + rng.random() * 0.45  # injected anomaly
                draw *= 0.955 + rng.random() * 0.09     # ±4.5% meter noise
                hour = 8 + period
                chronological.append({
                    "room_id": room["roomNumber"],
                    "building": room["building"],
                    "room_type": room["type"],
                    "hour": hour,
                    "period": period,
                    "day_of_week": day,
                    "occupancy": present,
                    "capacity": room["capacity"],
                    "lights_on": lights_on,
                    "fans_on": fans_on,
                    "historical_energy": 0.0,
                    "actual_energy": round(draw, 3),
                    "date": date_str,
                    "day_index": day_offset,
                })
        # fill lag feature (historical_energy = previous period's actual energy)
        for i, row in enumerate(chronological):
            if i > 0:
                row["historical_energy"] = round(chronological[i - 1]["actual_energy"] * (0.97 + rng.random() * 0.06), 3)
            else:
                row["historical_energy"] = round(chronological[i]["actual_energy"] * 0.9, 3)
            rows.append(row)
    return rows


def generate_occupancy_data(rooms, week_index, seed, start_date):
    rng = random.Random(seed + 1000)
    rows = []
    for room in rooms:
        is_lab = room["type"] in ("computer_lab", "physics_lab", "chemistry_lab", "electronics_lab")
        for day, periods in period_plan(room["roomNumber"], rng, is_lab):
            day_offset = week_index * 7 + day - 1
            date_str = (start_date + timedelta(days=day_offset)).isoformat()
            for period in periods:
                expected = round(room["capacity"] * (0.5 + rng.random() * 0.45))
                rate = actual_attendance_rate(room["roomNumber"], day, period, rng)
                present = min(room["capacity"], int(round(expected * rate)))
                rows.append({
                    "room_id": room["roomNumber"],
                    "building": room["building"],
                    "room_type": room["type"],
                    "day_of_week": day,
                    "period": period,
                    "expected_occupancy": expected,
                    "capacity": room["capacity"],
                    "faculty_id": f"FAC-{1000 + (js_hash(room['roomNumber']) % 900)}",
                    "faculty_avg_attendance": round(attendance_factor(room["roomNumber"]), 2),
                    "actual_attendance_rate": round(rate, 4),
                    "actual_present": present,
                    "date": date_str,
                    "day_index": day_offset,
                })
    return rows


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic energy + occupancy training data")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--days", type=int, default=91, help="calendar days of history per room (default 91 = ~2 months train + 1 week test)")
    args = parser.parse_args()

    rooms = parse_rooms_js()
    weeks = max(1, args.days // 7)
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)

    energy_rows = []
    occ_rows = []
    for w in range(weeks):
        energy_rows.extend(generate_energy_data(rooms, w, args.seed + w, START_DATE))
        occ_rows.extend(generate_occupancy_data(rooms, w, args.seed + w, START_DATE))

    energy_file = os.path.join(DATA_DIR, "training_data.csv")
    with open(energy_file, "w") as f:
        f.write("room_id,building,room_type,hour,period,day_of_week,occupancy,capacity,lights_on,fans_on,historical_energy,actual_energy,date,day_index\n")
        for r in energy_rows:
            f.write(",".join(str(r[k]) for k in ["room_id", "building", "room_type", "hour", "period", "day_of_week", "occupancy", "capacity", "lights_on", "fans_on", "historical_energy", "actual_energy", "date", "day_index"]) + "\n")

    occ_file = os.path.join(DATA_DIR, "occupancy_training_data.csv")
    with open(occ_file, "w") as f:
        f.write("room_id,building,room_type,day_of_week,period,expected_occupancy,capacity,faculty_id,faculty_avg_attendance,actual_attendance_rate,actual_present,date,day_index\n")
        for r in occ_rows:
            f.write(",".join(str(r[k]) for k in ["room_id", "building", "room_type", "day_of_week", "period", "expected_occupancy", "capacity", "faculty_id", "faculty_avg_attendance", "actual_attendance_rate", "actual_present", "date", "day_index"]) + "\n")

    print(f"Generated {len(energy_rows)} energy rows ({weeks} weeks = ~{weeks - 1} weeks train + 1 week held-out test) -> {energy_file}")
    print(f"Generated {len(occ_rows)} occupancy rows -> {occ_file}")


if __name__ == "__main__":
    sys.exit(main())