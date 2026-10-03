import Alert from '../models/Alert.js';

/** Classify a percentage difference against configurable thresholds. */
export function classifyDifference(pct, settings) {
  const abnormal = settings?.anomaly?.abnormalPct ?? 20;
  const warning = settings?.anomaly?.warningPct ?? 10;
  if (pct > abnormal) return 'abnormal';
  if (pct > warning) return 'warning';
  return 'normal';
}

export function severityForDifference(pct) {
  if (pct > 60) return 'critical';
  if (pct > 40) return 'high';
  if (pct > 20) return 'medium';
  return 'low';
}

export function safePercentage(actual, predicted) {
  if (!predicted || predicted <= 0) return 0;
  return ((actual - predicted) / predicted) * 100;
}

/** True when the (positive) difference exceeds the abnormal threshold. */
export function isAbnormal(actual, predicted, settings) {
  const abnormalPct = settings?.anomaly?.abnormalPct ?? 20;
  return predicted > 0 && actual > predicted * (1 + abnormalPct / 100);
}

/** Ensure we do not spam identical active alerts for the same room+type. */
export async function existingActiveAlert(roomId, type) {
  return Alert.findOne({ roomId, type, status: { $in: ['active', 'contacted'] } }).sort({ createdAt: -1 });
}

export default {
  classifyDifference,
  severityForDifference,
  safePercentage,
  isAbnormal,
  existingActiveAlert
};