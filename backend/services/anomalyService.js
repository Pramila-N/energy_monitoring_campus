import Alert from '../models/Alert.js';

/**
 * Single source of truth for the label shown everywhere (classroom status AND
 * alert severity). One word, one set of thresholds, so the dashboard never
 * shows "abnormal" in one place and "medium"/"critical" in another for the
 * same deviation.
 */
export function levelForDifference(pct, settings) {
  const abnormal = settings?.anomaly?.abnormalPct ?? 20;
  const warning = settings?.anomaly?.warningPct ?? 10;
  const high = settings?.anomaly?.highPct ?? 40;
  const critical = settings?.anomaly?.criticalPct ?? 60;
  if (pct > critical) return 'critical';
  if (pct > high) return 'high';
  if (pct > abnormal) return 'abnormal';
  if (pct > warning) return 'warning';
  return 'normal';
}

/** Classroom state label — same vocabulary/thresholds as alert severity. */
export function classifyDifference(pct, settings) {
  return levelForDifference(pct, settings);
}

/** Alert severity — now identical to the classroom status label. */
export function severityForDifference(pct, settings) {
  return levelForDifference(pct, settings);
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