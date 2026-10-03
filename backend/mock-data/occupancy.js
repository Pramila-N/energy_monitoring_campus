/**
 * DUMMY DATA LAYER — Occupancy behaviour
 * Deterministic per-room attendance factors, mirroring the generator used for
 * ml/data/occupancy_training_data.csv so live + training patterns agree.
 */

function hashString(str) {
  let h = 7;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const cache = new Map();

/** Deterministic 0.55 - 0.95 average attendance factor for a room. */
export function facultyAttendanceFactor(roomNumber) {
  if (cache.has(roomNumber)) return cache.get(roomNumber);
  const value = Number((0.55 + (hashString(roomNumber) % 40) / 100).toFixed(2));
  cache.set(roomNumber, value);
  return value;
}

/** Deterministic per-period and per-day attendance effects. */
export function dayEffect(dayOfWeek) {
  const map = { 1: 1.0, 2: 1.02, 3: 0.98, 4: 0.96, 5: 0.9, 6: 0.7, 0: 0.4 };
  return map[dayOfWeek] ?? 0.9;
}

export function periodEffect(period) {
  // mornings better attended; late afternoon drops
  const map = { 1: 1.0, 2: 1.0, 3: 0.99, 4: 0.94, 5: 0.88, 6: 0.8, 7: 0.72, 8: 0.65 };
  return map[period] ?? 0.85;
}

export function buildFacultyIdForRoom(roomNumber) {
  return `FAC-${1000 + (hashString(roomNumber) % 900)}`.padStart(4, '0');
}

export default { facultyAttendanceFactor, dayEffect, periodEffect, buildFacultyIdForRoom };