import Setting from '../models/Setting.js';

const DEFAULTS = {
  anomaly: {
    warningPct: 10,
    abnormalPct: 20,
    alertCooldownMinutes: 20
  },
  simulation: {
    intervalMs: null,
    minutesPerTick: null,
    autoStart: true
  }
};

export async function loadSettings() {
  const map = {};
  const rows = await Setting.find({});
  rows.forEach((r) => {
    map[r.key] = r.value;
  });
  const merged = {
    anomaly: {
      warningPct: Number(map['anomaly.warningPct'] ?? DEFAULTS.anomaly.warningPct),
      abnormalPct: Number(map['anomaly.abnormalPct'] ?? DEFAULTS.anomaly.abnormalPct),
      alertCooldownMinutes: Number(map['anomaly.alertCooldownMinutes'] ?? DEFAULTS.anomaly.alertCooldownMinutes)
    }
  };
  if (process.env.NODE_ENV !== 'test') {
    merged.simulation = {
      intervalMs: Number(map['simulation.intervalMs'] ?? 8000),
      minutesPerTick: Number(map['simulation.minutesPerTick'] ?? 30)
    };
  }
  return merged;
}

export async function getSettings() {
  return loadSettings();
}

export async function updateSettings(partial) {
  if (partial.anomaly) {
    for (const [k, v] of Object.entries(partial.anomaly)) {
      if (DEFAULTS.anomaly[k] !== undefined && v !== undefined && v !== '') {
        await Setting.findOneAndUpdate(
          { key: `anomaly.${k}` },
          { $set: { value: Number(v) } },
          { upsert: true }
        );
      }
    }
  }
  return loadSettings();
}

export default { getSettings, updateSettings, loadSettings };