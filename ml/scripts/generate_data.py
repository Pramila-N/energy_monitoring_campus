"""
Generate realistic synthetic training data for the Smart Energy system.

The room/environment definitions are parsed from backend/mock-data so the
synthetic energy follows the same physical model the backend simulation uses
(single source of truth). The data includes normal and abnormal examples so the
anomaly-detection demo has realistic variance.

The campus runs 24/7: rows are generated for EVERY hour (0-23) of EVERY
calendar day (Mon-Sun), including night/weekend idle rows, so predictions stay
correct outside class hours. Schedule rules mirror
backend/mock-data/timetable.js (library open all hours; weekend operating
types; period 0 = off-hours).

Outputs:
    ml/data/training_data.csv              (energy model)
    ml/data/occupancy_training_data.csv    (occupancy model)

Each row also carries an artificial calendar date + day_index so training can
hold out the FINAL month chronologically (one month of unseen "future" test
data after ~3 months of training data) — exactly the demo shown to faculty.
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
    "library":         {"equipment": 0.35, "occ_scale": 1.1, "idle": 0.30},
    "placement_cell":  {"equipment": 0.3, "occ_scale": 0.9, "idle": 0.40},
    "conference_hall": {"equipment": 0.7, "occ_scale": 1.7, "idle": 0.25},
    "academic_lab":    {"equipment": 0.9, "occ_scale": 1.3, "idle": 0.40},
    "special_lab":     {"equipment": 1.3, "occ_scale": 1.4, "idle": 0.50},
}

# Mirrors backend/mock-data/occupancy.js dayEffect/periodEffect (Mon=1..Sun=7;
# period 0 = off-hours, periods 1-15 = 09:00-23:00 class windows incl night batches).
DAY_EFFECT = {1: 1.0, 2: 1.02, 3: 0.98, 4: 0.96, 5: 0.90, 6: 0.70, 7: 0.45, 0: 0.40}
PERIOD_EFFECT = {
    0: 0.30, 1: 1.0, 2: 1.0, 3: 0.99, 4: 0.94, 5: 0.88, 6: 0.80, 7: 0.72, 8: 0.65,
    9: 0.62, 10: 0.58, 11: 0.55, 12: 0.52, 13: 0.50, 14: 0.48, 15: 0.46,
}

# Mirrors backend/mock-data/timetable.js schedule rules.
LAB_TYPES = [
    "computer_lab", "physics_lab", "chemistry_lab", "electronics_lab",
    "seminar_hall", "academic_lab", "special_lab", "conference_hall",
]
OPEN_ALL_HOURS_TYPES = {"library"}
OPEN_DAYS = {  # last weekday a type operates (1=Mon..7=Sun); default 5
    "staff_room": 6,
    "conference_hall": 6,
    "placement_cell": 5,
    "computer_lab": 7,
    "academic_lab": 7,
    "special_lab": 7,
}


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


def period_for_hour(hour):
    """Same rule as timetable.js periodForHour(): class periods run 09:00-23:00
    (period 1..15 = hour - 8, so evening/night batches are normal classes);
    00:00-08:00 are deep off-hours (period 0)."""
    if hour < 9:
        return 0
    return hour - 8


def scheduled_periods(room_type, day, rng):
    """Set of scheduled periods (0..15) for a room on a weekday-numbered day,
    mirroring timetable.js buildTimetable()."""
    if room_type in OPEN_ALL_HOURS_TYPES:
        return set(range(0, 16))  # library: every hour of every day
    if day > OPEN_DAYS.get(room_type, 5):
        return set()  # closed that day (weekends for most types)
    if day >= 6:
        count = 2 + rng.randint(0, 2)  # reduced weekend schedule
    elif room_type == "staff_room":
        return set(range(1, 16))  # staff on duty all class hours (09:00-23:00)
    elif room_type in LAB_TYPES:
        count = 2 + rng.randint(0, 2)
    else:
        count = 3 + rng.randint(0, 4)

    periods = []
    p = 1 + rng.randint(0, 7)
    while len(periods) < count and p <= 15:
        periods.append(p)
        if room_type in LAB_TYPES and day < 6:
            p += rng.randint(0, 2)  # some labs run 2-3 period blocks
        p += 1
        if len(periods) < count:
            p += rng.randint(0, 1)
    return set(periods)


def expected_occupancy(room, day, period, expected_rate):
    if room["type"] == "staff_room":
        return 6 + (day % 3)
    return max(4, round(room["capacity"] * expected_rate))


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


def day_plan(room, week_index, sched_seed):
    """Yield (day, date, dow, scheduled_periods) for all 7 days of the week.
    Seeded per room so each room gets its own stable weekly schedule."""
    rng = random.Random(f"{sched_seed}|{room['roomNumber']}")
    for day in range(1, 8):
        day_offset = week_index * 7 + day - 1
        date = START_DATE + timedelta(days=day_offset)
        dow = date.weekday() + 1  # Mon=1..Sun=7 (backend academicDay)
        yield day, date, dow, scheduled_periods(room["type"], day, rng)


def generate_energy_data(rooms, week_index, seed):
    rng = random.Random(seed)
    rows = []
    for room in rooms:
        expected_rate = 0.5 + rng.random() * 0.45
        chronological = []
        for day, date, dow, sched in day_plan(room, week_index, seed):
            date_str = date.isoformat()
            for hour in range(24):
                period = period_for_hour(hour)
                is_open = period in sched
                present = 0
                if is_open:
                    expected = expected_occupancy(room, day, period, expected_rate)
                    rate = actual_attendance_rate(room["roomNumber"], dow, period, rng)
                    present = min(room["capacity"], int(round(expected * rate)))
                lights_on = 1 if present > 0 else (1 if rng.random() < 0.06 else 0)
                fans_on = 1 if present > 0 else (1 if rng.random() < 0.04 else 0)
                draw = room_draw(room, present, lights_on, fans_on)
                if present > 0 and period >= 1 and rng.random() < 0.04:
                    draw *= 1.45 + rng.random() * 0.45  # injected anomaly (occupied rooms, day or night)
                draw *= 0.955 + rng.random() * 0.09     # ±4.5% meter noise
                chronological.append({
                    "room_id": room["roomNumber"],
                    "building": room["building"],
                    "room_type": room["type"],
                    "hour": hour,
                    "period": period,
                    "day_of_week": dow,
                    "occupancy": present,
                    "capacity": room["capacity"],
                    "lights_on": lights_on,
                    "fans_on": fans_on,
                    "historical_energy": 0.0,
                    "actual_energy": round(draw, 3),
                    "date": date_str,
                    "day_index": week_index * 7 + day - 1,
                })
        # fill lag feature (historical_energy = previous hour's actual energy)
        for i, row in enumerate(chronological):
            if i > 0:
                row["historical_energy"] = round(chronological[i - 1]["actual_energy"] * (0.97 + rng.random() * 0.06), 3)
            else:
                row["historical_energy"] = round(chronological[i]["actual_energy"] * 0.9, 3)
            rows.append(row)
    return rows


def generate_occupancy_data(rooms, week_index, seed):
    rng = random.Random(seed + 1000)
    rows = []
    for room in rooms:
        expected_rate = 0.5 + rng.random() * 0.45
        for day, date, dow, sched in day_plan(room, week_index, seed):
            date_str = date.isoformat()
            for hour in range(24):
                period = period_for_hour(hour)
                is_open = period in sched
                if is_open:
                    expected = expected_occupancy(room, day, period, expected_rate)
                    rate = actual_attendance_rate(room["roomNumber"], dow, period, rng)
                    present = min(room["capacity"], int(round(expected * rate)))
                else:
                    expected = 0
                    rate = 0.0  # closed room -> model must predict a zero rate
                    present = 0
                rows.append({
                    "room_id": room["roomNumber"],
                    "building": room["building"],
                    "room_type": room["type"],
                    "day_of_week": dow,
                    "period": period,
                    "expected_occupancy": expected,
                    "capacity": room["capacity"],
                    "faculty_id": f"FAC-{1000 + (js_hash(room['roomNumber']) % 900)}",
                    "faculty_avg_attendance": round(attendance_factor(room["roomNumber"]), 2),
                    "actual_attendance_rate": round(rate, 4),
                    "actual_present": present,
                    "date": date_str,
                    "day_index": week_index * 7 + day - 1,
                })
    return rows


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic energy + occupancy training data")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--days", type=int, default=119, help="calendar days of history per room (default 119 = ~3 months total)")
    parser.add_argument("--test-days", type=int, default=28, help="calendar days held out as the future test month (default 28 = 4 weeks)")
    args = parser.parse_args()

    if args.days <= args.test_days:
        print("--days must be greater than --test-days")
        sys.exit(1)

    rooms = parse_rooms_js()
    weeks = max(1, args.days // 7)
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)

    energy_rows = []
    occ_rows = []
    for w in range(weeks):
        energy_rows.extend(generate_energy_data(rooms, w, args.seed + w))
        occ_rows.extend(generate_occupancy_data(rooms, w, args.seed + w))

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

    print(f"Generated {len(energy_rows)} energy rows ({weeks} weeks x 7 days x 24 hours; last {args.test_days} calendar days are held out as the future test month) -> {energy_file}")
    print(f"Generated {len(occ_rows)} occupancy rows -> {occ_file}")


if __name__ == "__main__":
    sys.exit(main())
