/**
 * DUMMY DATA LAYER — College Attendance / Timetable
 *
 * Simulates the information that will eventually come from the college
 * attendance application. The schedule is deterministic (seeded PRNG) so
 * the demo is stable across restarts.
 *
 * The module also exports the attendance plan as:
 *   - ml/data/prediction_input.csv
 *   - ml/data/occupancy_prediction_input.csv
 * so the ML pipeline treats it as an external input the same way a future
 * attendance API would provide it.
 */
import fs from 'fs';
import path from 'path';
import ROOMS from './rooms.js';
import FACULTY from './faculty.js';

export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
export const PERIOD_HOURS = { 1: 9, 2: 10, 3: 11, 4: 12, 5: 13, 6: 14, 7: 15, 8: 16 };
export const LAB_TYPES = ['computer_lab', 'physics_lab', 'chemistry_lab', 'electronics_lab', 'seminar_hall'];

function seededRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seededRandom(20240901);

const roomIndex = {};
ROOMS.forEach((r) => {
  roomIndex[r.roomNumber] = r;
});
const facultyIndex = {};
FACULTY.forEach((f) => {
  facultyIndex[f.employeeId] = f;
});
const facultyByRoom = {};
FACULTY.forEach((f) => {
  f.rooms.forEach((rn) => {
    facultyByRoom[rn] = f;
  });
});

function isLab(type) {
  return LAB_TYPES.includes(type);
}

function buildTimetable() {
  const tt = {};
  const expRate = {};
  ROOMS.forEach((room) => {
    if (room.type === 'staff_room') {
      tt[room.roomNumber] = { 1: PERIODS.slice(), 2: PERIODS.slice(), 3: PERIODS.slice(), 4: PERIODS.slice(), 5: PERIODS.slice() };
      expRate[room.roomNumber] = 0.55;
      return;
    }
    const days = {};
    const perRoomExp = 0.5 + rand() * 0.45; // expected attendance factor
    expRate[room.roomNumber] = perRoomExp;

    for (let d = 1; d <= 5; d++) {
      const periods = [];
      const count = isLab(room.type) ? 2 + Math.floor(rand() * 3) : 3 + Math.floor(rand() * 5);
      let p = 1 + Math.floor(rand() * 3);
      while (periods.length < count && p <= 8) {
        periods.push(p);
        if (isLab(room.type)) {
          const block = Math.floor(rand() * 3); // some labs run 2-3 period blocks
          for (let k = 1; k <= block && periods.length < 8 && periods.length < count; k++) p += 1;
        }
        p += 1;
        if (periods.length < count) p += Math.floor(rand() * 2);
      }
      if (periods.length > 0) days[d] = periods;
    }
    tt[room.roomNumber] = days;
  });
  return { tt, expRate };
}

const { tt: TIMETABLE, expRate: EXPECTED_RATE } = buildTimetable();

// Pin the demo-showcase rooms to a fixed schedule so the anomaly workflow can
// be demonstrated any time the app is opened (morning periods).
const DEMO_SCHEDULES = {
  'C-204': { 1: [1, 2, 3], 2: [1, 2, 3], 3: [1, 2, 3], 4: [1, 2, 3], 5: [1, 2, 3] },
  'C-101': { 1: [1, 2, 3, 4], 2: [1, 2, 3], 3: [2, 3, 4], 4: [1, 2, 3], 5: [1, 2, 3, 4] },
  'C-305': { 1: [7, 8], 2: [7, 8], 3: [7, 8], 4: [7, 8], 5: [7, 8] }
};
Object.keys(DEMO_SCHEDULES).forEach((rn) => {
  if (TIMETABLE[rn]) TIMETABLE[rn] = DEMO_SCHEDULES[rn];
});

export function getTimetable() {
  return TIMETABLE;
}

export function getScheduleFor(roomNumber, day) {
  return TIMETABLE[roomNumber]?.[day] || [];
}

export function getExpectedOccupancyByRate(roomNumber) {
  return EXPECTED_RATE[roomNumber] ?? 0.7;
}

export function isRoomScheduled(roomNumber, day, period) {
  const periods = getScheduleFor(roomNumber, day);
  return periods.includes(period);
}

export function getExpectedOccupancy(room) {
  if (!room) return 0;
  const rate = getExpectedOccupancyByRate(room.roomNumber);
  return Math.max(
    4,
    Math.round(room.capacity * rate * (0.9 + ((room.roomNumber.length % 5) - 2) / 20))
  );
}

export function periodForHour(hour) {
  if (hour < 9) return null;
  if (hour > 16) return 8;
  return hour - 8;
}

export function periodStartHour(period) {
  return PERIOD_HOURS[period] || 9;
}

/**
 * Export the current week's attendance plan to the ML input folder.
 * Returns the list of produced files.
 */
export function exportPredictionInput(mlDir) {
  const dataDir = path.join(mlDir, 'data');

  const now = new Date();
  const monday = new Date(now);
  const dow = (now.getDay() + 6) % 7; // Monday = 0
  monday.setDate(now.getDate() - dow);

  const rows = [];
  const occRows = [];

  for (let d = 0; d < 5; d++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + d);
    const dateStr = date.toISOString().slice(0, 10);
    const day = d + 1;

    ROOMS.forEach((room) => {
      const f = facultyByRoom[room.roomNumber];
      const periods = getScheduleFor(room.roomNumber, day);
      periods.forEach((period) => {
        const exp = room.type === 'staff_room'
          ? 8 + Math.round(rand() * 6)
          : Math.round(room.capacity * EXPECTED_RATE[room.roomNumber]);
        rows.push([
          room.roomNumber,
          dateStr,
          period,
          f ? f.employeeId : '',
          exp
        ].join(','));
        occRows.push([
          room.roomNumber,
          dateStr,
          period,
          day,
          exp,
          room.type.charAt(0).toUpperCase() + room.type.slice(1).replace('_', ' '),
          room.capacity,
          f ? f.employeeId : ''
        ].join(','));
      });
    });
  }

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const predFile = path.join(dataDir, 'prediction_input.csv');
  fs.writeFileSync(predFile, ['room_id,date,period,faculty_id,expected_occupancy', ...rows].join('\n'));

  const occFile = path.join(dataDir, 'occupancy_prediction_input.csv');
  fs.writeFileSync(occFile, ['room_id,date,period,day_of_week,expected_occupancy,room_type,capacity,faculty_id', ...occRows].join('\n'));

  return { predFile, occFile };
}

export default TIMETABLE;