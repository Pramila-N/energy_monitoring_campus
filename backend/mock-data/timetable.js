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

export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
export const PERIOD_HOURS = Object.fromEntries(PERIODS.map((p) => [p, 8 + p])); // 09:00..23:00
export const LAB_TYPES = ['computer_lab', 'physics_lab', 'chemistry_lab', 'electronics_lab', 'seminar_hall', 'academic_lab', 'special_lab', 'conference_hall'];

/** 24/7 open (all days, all hours — period 0 = off-hours + class periods). */
export const OPEN_ALL_HOURS_TYPES = ['library'];

/** Last day of the week a type operates (1=Mon..7=Sun). Default = 5 (weekday). */
const OPEN_DAYS = {
  staff_room: 6,
  conference_hall: 6,
  placement_cell: 5,
  computer_lab: 7,
  academic_lab: 7,
  special_lab: 7
};

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
    const perRoomExp = room.type === 'staff_room' ? 0.55 : 0.5 + rand() * 0.45;
    expRate[room.roomNumber] = perRoomExp;

    // 24/7 rooms (library): open every hour of every day of the week.
    if (OPEN_ALL_HOURS_TYPES.includes(room.type)) {
      const all = [0, ...PERIODS];
      tt[room.roomNumber] = {};
      for (let d = 1; d <= 7; d++) tt[room.roomNumber][d] = all.slice();
      return;
    }

    const days = {};
    const maxDay = OPEN_DAYS[room.type] || 5;

    for (let d = 1; d <= maxDay; d++) {
      const periods = [];
      if (d >= 6) {
        // Weekend (Sat/Sun): reduced schedule for labs / halls / staff.
        const count = 2 + Math.floor(rand() * 3);
        let p = 1 + Math.floor(rand() * 10);
        while (periods.length < count && p <= 15) {
          periods.push(p);
          p += 1 + Math.floor(rand() * 2);
        }
      } else {
        if (room.type === 'staff_room') {
          days[d] = PERIODS.slice(); // staff on duty all class hours (09:00-23:00)
          continue;
        }
        const count = isLab(room.type) ? 2 + Math.floor(rand() * 3) : 3 + Math.floor(rand() * 5);
        let p = 1 + Math.floor(rand() * 8);
        while (periods.length < count && p <= 15) {
          periods.push(p);
          if (isLab(room.type)) {
            const block = Math.floor(rand() * 3); // some labs run 2-3 period blocks
            for (let k = 1; k <= block && periods.length < 15 && periods.length < count; k++) p += 1;
          }
          p += 1;
          if (periods.length < count) p += Math.floor(rand() * 2);
        }
      }
      if (periods.length > 0) days[d] = periods;
    }
    tt[room.roomNumber] = days;
  });
  return { tt, expRate };
}

const { tt: TIMETABLE, expRate: EXPECTED_RATE } = buildTimetable();

// Pin the demo-showcase rooms to a fixed schedule so the anomaly workflow can
// be demonstrated any time the app is opened — morning and evening batches.
const DEMO_SCHEDULES = {
  'C-204': { 1: [1, 2, 3, 9, 10, 11], 2: [1, 2, 3, 9, 10, 11], 3: [1, 2, 3, 9, 10, 11], 4: [1, 2, 3, 9, 10, 11], 5: [1, 2, 3, 9, 10, 11] },
  'C-101': { 1: [1, 2, 3, 4], 2: [1, 2, 3], 3: [2, 3, 4], 4: [1, 2, 3], 5: [1, 2, 3, 4] },
  'C-305': { 1: [7, 8], 2: [7, 8], 3: [7, 8], 4: [7, 8], 5: [7, 8] }
};
Object.keys(DEMO_SCHEDULES).forEach((rn) => {
  if (TIMETABLE[rn]) Object.assign(TIMETABLE[rn], DEMO_SCHEDULES[rn]); // override Mon-Fri, keep generated weekend days
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
  // 24/7 campus: class periods run 09:00-23:00 (period 1..15 = hour - 8) so
  // evening/night batches are normal; hours 00:00-08:00 are deep off-hours (0).
  if (hour < 9) return 0;
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

  for (let d = 0; d < 7; d++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + d);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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