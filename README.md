# AI-Based Smart Energy Monitoring and Optimization System for Campus Buildings

A full-stack IoT-style platform that collects live energy telemetry from (simulated) smart
metering sensors in campus classrooms, uses **real machine-learning models** to forecast the
expected energy consumption of every room, flags anomalies in real time, alerts the responsible
faculty, and suggests optimization actions — all inside an admin dashboard.

React 18 · Vite · Tailwind · Node/Express · MongoDB · Python · scikit-learn

---

## 1. Project Overview

Every classroom on campus is equipped with smart meters, presence sensors and controllable
lights/fans (an internet of things). This system:

1. Streams **live energy readings** (kWh per 30‑min slot, voltage, current, power) plus
   **occupancy snapshots** from every room.
2. Builds **ML feature vectors** per room from people count, timetable slot, time-of-day
   and historical consumption.
3. Uses trained **scikit-learn models** to predict the *expected* consumption of each room
   for the current slot.
4. Compares the **actual meter reading** against the AI prediction every cycle.
5. If consumption deviates more than a configurable threshold (default: warning `> 10%`,
   abnormal `> 20%`), the room is marked `warning`/`abnormal`, an **alert** is created
   (severity escalates with the deviation), and **optimization recommendations** are generated.
6. The dashboard lets an admin **contact the faculty** automatically (simulated call/email)
   and **resolve** the alert with a resolution note.

Models were trained on generated-but-realistic campus data; measured offline accuracy is
**R² ≈ 0.86 / MAE ≈ 0.09 kWh** for the energy model and **R² ≈ 0.48 / MAE ≈ 0.05** for the
occupancy model (details in section 5).

### Live demo scenario

Open the app in a morning period and inspect room **C-204** — a demo scenario applies a
`1.72×` consumption multiplier to its meters, so the AI prediction (~2.6 kWh) and the actual
reading (~4.2 kWh, **+68 %**) diverge, matching the showcase in the mockup. **C-305** demos the
"appliances left on in an empty room" case and **A-103** the "low occupancy, high energy" case.
These scenarios are defined in `backend/mock-data/scenarios.js`.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      React + Vite + Tailwind                        │
│              admin dashboard (all pages below menu)                 │
└───────────────▲─────────────────────────────────────────────────────┘
                │ JSON over REST (JWT-secured)
┌───────────────┴─────────────────────────────────────────────────────┐
│                     Node.js / Express backend                       │
│                                                                     │
│  controllers → services → models (MongoDB via Mongoose)            │
│    ├─ simulationService   → ticks the clock every 8 s (30 min/tick) │
│    ├─ predictionService   → builds ML feature vectors + clips       │
│    ├─ mlService           → persistent Python inference server      │
│    ├─ anomalyService      → compares actual vs predicted, alerting  │
│    └─ recommendationService→ rule engine for optimization actions   │
└───────────────▲─────────────────────────────────────────────────────┘
                │ line-delimited JSON (stdin/stdout), auto-restart
┌───────────────┴─────────────────────────────────────────────────────┐
│               Python inference server (scikit-learn)                │
│   loads energy_model.joblib + occupancy_model.joblib once,          │
│   serves per-request forecasts with per-process model reuse         │
└─────────────────────────────────────────────────────────────────────┘

Dummy sensor/source layer (swap for real IoT):
  backend/mock-data/ (rooms, buildings, faculty, timetable, energy profiles, scenarios)
  ml/data/*.csv      (attendance-app stand-in exported by the seed script)
```

**Why a persistent Python server?** Spawning a new Python process for every prediction pass
proved flaky on Windows (occasional hangs). `mlService` now spawns `inference_server.py` once
and communicates over newline-delimited JSON with a 60 s per-request timeout and automatic
restart, so a full 30-room prediction pass completes in ~100 ms.

---

## 3. Tech Stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React 18, Vite 5, Tailwind CSS 3, React Router 6, Axios, Recharts, Lucide React, React Hook Form |
| Backend   | Node 18+, Express, Mongoose (MongoDB), JSON Web Tokens, bcryptjs |
| ML        | Python 3.10+, pandas, scikit-learn, joblib (scikit 1.7.x verified) |
| Database  | MongoDB 8.x (any recent local/Atlas instance) |
| Orchestration | low `concurrently` dev script |

---

## 4. Folder Structure

```
mini project 7/
├── package.json            # root orchestration (seed/train/dev scripts)
├── .env.example            # environment template (copy to backend/.env)
├── backend/
│   ├── server.js           # entry point — starts API + simulation
│   ├── app.js              # Express app, CORS, routes, error handler
│   ├── config/             # env.js (dotenv), database.js (Mongo connect)
│   ├── models/             # Admin, Building, Classroom, Faculty,
│   │                       # EnergyReading, OccupancyReading, Prediction,
│   │                       # Alert, Recommendation, Setting
│   ├── mock-data/          # buildings, rooms, faculty, timetable,
│   │                       # occupancy, energyProfile, scenarios + exportPredictionInput
│   ├── services/           # simulation, prediction, ml, anomaly, alert,
│   │                       # recommendation, energy, report, settings
│   ├── controllers/        # thin request handlers
│   ├── routes/index.js     # all API routes (see §9)
│   ├── middleware/         # JWT protect, error handler
│   └── scripts/seed.js     # creates system data + generates history, exports ML input
├── ml/
│   ├── requirements.txt
│   ├── scripts/
│   │   ├── generate_data.py            # builds 4-week training dataset
│   │   ├── train_model.py              # trains energy model
│   │   ├── train_occupancy_model.py    # trains occupancy model
│   │   ├── predict.py                  # per-call energy prediction (fallback)
│   │   ├── predict_occupancy.py        # per-call occupancy prediction (fallback)
│   │   ├── evaluate_model.py           # offline accuracy report
│   │   └── inference_server.py         # persistent server used by backend
│   ├── data/               # training + prediction-input CSVs (gitignored, generated)
│   └── models/             # *.joblib + metrics.json (gitignored, trained)
└── frontend/
    ├── vite.config.js      # dev server on :5173
    ├── .env                # VITE_API_URL=http://localhost:5000/api
    └── src/
        ├── api/client.js   # axios + JWT interceptor
        ├── context/        # Auth + Toast providers
        ├── hooks/          # useApi / usePolling
        ├── components/     # layout, charts, badges, stat cards, modals
        └── pages/          # 13 screens (login, dashboard, buildings, …)
```

---

## 5. How the AI Works

### Feature engineering (per room, per tick)
```
energy_features:  people_count | day_of_week | period | hour | historical_energy
                  | room_type | capacity | num_lights | num_fans | has_ac | is_lab
occupancy_features: day_of_week | period | building | room_type | capacity
                  | faculty_scheduled | year_of_study | avg_attendance | course_weight
```
The energy features come from the *occupancy model's* people-count output (predicted at the
start of the cycle), the timetable, time-of-day, and the room's own recent historical rate —
exactly the "people count + schedule + time-of-day" recipe from the project brief.

### Model training (offline)
- Data: `ml/scripts/generate_data.py` produces a 4‑week history of
  per-slot energy/occupancy snapshots (`ml/data/training_data.csv`).
- `ml/scripts/train_model.py` evaluates Linear Regression, Random Forest, Gradient Boosting
  and SVR, then persists the best estimator with a fitted pipeline as
  `ml/models/energy_model.joblib`.
- `ml/scripts/train_occupancy_model.py` does the same for occupancy (Random Forest was best).
- `ml/scripts/evaluate_model.py` prints hold-out R², MAE, RMSE, MAPE and stores
  `ml/models/metrics.json` + `occupancy_metrics.json` (served by the dashboard).

### Measured accuracy (hold-out)
| Model | R² | MAE | RMSE | MAPE |
|-------|-----|------|------|------|
| Energy | 0.8637 | 0.0893 kWh | 0.211 kWh | 6.03 % |
| Occupancy | 0.48 | 0.05 | — | — |

### Anomaly detection (runtime)
Each cycle the prediction service forecasts expected kWh for every room; the meter value is
compared and a percentage deviation computed. The thresholds are **configurable in Settings**:

- `|deviation| > warning% (10)` → room status `warning`
- `|deviation| > abnormal% (20)` → room status `abnormal` + alert created
- `|deviation| > abnormal%` and room occupied → `EXCESS_ENERGY` alert
- room empty but lights/fans on → `EMPTY_ROOM_APPLIANCES` alert
- same alert type/room is suppressed within a cooldown window (dedupe)

The recommendation engine converts each problem into an actionable suggestion
(`EXCESS_ENERGY`, `EMPTY_ROOM_APPLIANCES`, `LOW_OCCUPANCY_HIGH_ENERGY`) with a reason and
priority, auto-resolving stale entries when the condition clears.

---

## 6. Live Simulation & Dummy Data Source

There are no real sensors or attendance APIs in this demo. Everything is **generated on the
fly** by the backend so the dashboard is always live:

- **Clock**: the simulation starts at 09:30 and advances **30 minutes every 8 seconds**
  (`SIM_INTERVAL_MS`, `SIM_MINUTES_PER_TICK` in `backend/.env`), cycling Monday–Friday
  across two academic weeks.
- **Timetable**: `backend/mock-data/timetable.js` builds realistic per-room weekly schedules
  (labs get longer blocks, staff rooms are always warm, etc.) and pins the demo rooms
  (C‑204, C‑101, C‑305) so the showcase always runs in the morning.
- **Occupancy**: `occupancyService` combines timetable, absenteeism and course weight; the
  **occupancy ML model** filters sensor noise to predict expected occupants.
- **Appliances**: lights/fans turn on when a class is expected and presence is detected, and
  auto-switch off when the room empties — except where a scenario injects waste.
- **Energy**: `energyService` computes the room draw (lights × 18 W, fans × 65 W, plus
  profile-based room/equipment load) and writes `EnergyReading` documents. Scenarios such as a
  `1.72×` consumption multiplier (C‑204) or stuck lights (C‑305) are applied from
  `backend/mock-data/scenarios.js`.
- **ML input export**: the seed script exports today's schedule as
  `ml/data/prediction_input.csv` + `occupancy_prediction_input.csv` — the stand-in for a
  campus attendance app dumping tomorrow's expected counts.

### Replacing the dummies with real hardware
1. Point the IoT gateway to `POST /api/energy/readings` (and occupancy) or write a small
   collector that inserts `EnergyReading`/`OccupancyReading` documents — the schema is
   already there.
2. Replace `ml/data/prediction_input.csv` with a real attendance/timetable feed.
3. Enable `startSimulation(false)` so the live clock follows wall-clock time; nothing else
   in the stack changes.

---

## 7. Setup & Running

### Prerequisites
- Node.js 18+ (tested on Node 24)
- Python 3.10+ with `pip` (tested on 3.13)
- MongoDB running locally (`mongodb://localhost:27017`) or a connection string
- (Windows) PowerShell or your shell of choice

### 1) Install dependencies
```bash
# backend + frontend
npm install                      # root orchestrator (concurrently)
npm --prefix backend install
npm --prefix frontend install

# Python ML
python -m pip install -r ml/requirements.txt
```

### 2) Configure environment
```bash
cp .env.example backend/.env      # Windows: copy .env.example backend\.env
cp .env.example frontend/.env     # frontend already ships with VITE_API_URL
```

### 3) Train the ML models
```bash
python ml/scripts/train_model.py            # trains energy model (Linear Regression)
python ml/scripts/train_occupancy_model.py  # trains occupancy model (Random Forest)
python ml/scripts/evaluate_model.py         # optional accuracy report
```
Models land in `ml/models/` (`*.joblib` + `metrics.json`).

### 4) Seed the database
```bash
npm --prefix backend run seed       # creates admin, buildings, rooms, history + ML input CSV
# or, to wipe and reseed:  npm --prefix backend run seed:reset
# history length:          $env:SEED_HISTORY_TICKS=60 ; npm --prefix backend run seed   (PowerShell)
```
Creates the demo login and a few days of readings/predictions so every chart is populated.

### 5) Run everything
```bash
npm run dev           # concurrently: backend (:5000) + frontend (:5173)
```
Or separately: `npm run backend` and `npm run frontend` in two terminals.

### 6) Sign in
```
http://localhost:5173
Email   : admin@smartcampus.local
Password: Admin@123
```

---

## 8. API Overview

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Admin sign-in (JWT) |
| GET | `/api/auth/me` | Current admin profile |
| GET | `/api/dashboard/summary` | Stat cards, live rooms, alerts, model status |
| GET | `/api/dashboard/insights` | Nudges (anomalies, empty rooms w/ appliances, top consumer) |
| GET | `/api/buildings` · `/api/buildings/:id` | Buildings with rollups |
| GET | `/api/classrooms` · `/api/classrooms/:id` | Live room list / detail (series + hourly) |
| GET | `/api/faculty` · `/api/faculty/:id` | Faculty directory |
| GET | `/api/energy/readings` · `/api/energy/:roomId` · `/:roomId/series` | Meter telemetry |
| GET | `/api/predictions` · `/api/predictions/metrics` | Recent forecasts + model accuracy |
| POST | `/api/predictions/generate` | Re-run the forecast pass |
| GET | `/api/ml/status` | Model readiness |
| GET | `/api/alerts` | Alert feed (filter: status/severity/type/roomId) |
| POST | `/api/alerts/:id/contact` | Simulated faculty notification |
| POST | `/api/alerts/:id/resolve` | Resolve with note |
| GET | `/api/recommendations` | Optimization suggestions |
| POST | `/api/recommendations/generate` | Re-evaluate suggestions |
| POST | `/api/recommendations/:roomId/:type/resolve` | Apply & resolve a suggestion |
| GET | `/api/appliances` | Light/fan automation status + savings |
| GET | `/api/reports` · `/api/reports/export.csv` | Aggregates (day/week/month) + CSV |
| GET | `/api/settings` · PUT `/api/settings` | Threshold configuration |
| GET | `/api/simulation/status` · POST `/start` `/stop` | Simulation control |

---

## 9. Security Notes

- Passwords hashed with bcrypt; all routes (except `/auth/login` and `/health`) require a JWT
  from the `Authorization: Bearer <token>` header.
- `.env` files and trained model artifacts are gitignored — never commit secrets.
- For production, replace `JWT_SECRET`, tighten CORS, add rate limiting and HTTPS.

---

## 10. Roadmap / Future Integration

- Real IoT ingestion (ESP32 + MQTT → `POST /api/energy/readings`).
- Real attendance feed replacing `prediction_input.csv`.
- Live faculty contact (twilio / email) instead of the simulated notification.
- Time-series forecasting (Prophet/LSTM) for hourly campus load plus peak-shaving advice.
- Per-room fixed-energy budgets with daily quotas.