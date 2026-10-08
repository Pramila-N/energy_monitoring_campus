import Classroom from '../models/Classroom.js';
import Building from '../models/Building.js';
import EnergyReading from '../models/EnergyReading.js';
import OccupancyReading from '../models/OccupancyReading.js';
import Alert from '../models/Alert.js';
import Prediction from '../models/Prediction.js';
import Recommendation from '../models/Recommendation.js';
import { getSettings } from './settingsService.js';
import mlService from './mlService.js';
import predictionService from './predictionService.js';
import alertService from './alertService.js';
import recommendationService from './recommendationService.js';
import { computeRoomDraw } from '../mock-data/energyProfile.js';
import { getExpectedOccupancyByRate, isRoomScheduled, periodForHour } from '../mock-data/timetable.js';
import { scenarioFor } from '../mock-data/scenarios.js';
import { facultyAttendanceFactor, dayEffect, periodEffect } from '../mock-data/occupancy.js';

const MINUTES_PER_TICK = 30;
const INTERVAL_HOURS = MINUTES_PER_TICK / 60;

/** Deterministic PRNG (mulberry32) so history is stable across reseeds. */
function seededRandom(seedStr) {
  let seed = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    seed ^= seedStr.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  seed = seed >>> 0;
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same expected-occupancy derivation the live simulator + ML pipeline use. */
function expectedFor(room, period, academicDay) {
  const isStaff = room.type === 'staff_room';
  if (!isRoomScheduled(room.roomNumber, academicDay, period)) return 0;
  if (isStaff) return 6 + (academicDay % 3);
  return Math.max(4, Math.round(room.capacity * (getExpectedOccupancyByRate(room.roomNumber) || 0.7)));
}

function presenceFor(room, period, academicDay, dateStr, expected) {
  if (expected <= 0) return 0;
  const rng = seededRandom(`${room.roomNumber}-${dateStr}-${period}`);
  const base = facultyAttendanceFactor(room.roomNumber) * dayEffect(academicDay) * periodEffect(period);
  const rate = Math.max(0.1, Math.min(1, base * (0.8 + rng() * 0.4)));
  if (rng() < 0.03) return 0; // occasional cancelled session
  return Math.min(room.capacity, Math.round(expected * rate));
}

function lastCalendarDates(dayCount) {
  // 24/7 campus — every calendar day counts (weekends included); today always included.
  const dates = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  dates.push(new Date(cursor));
  cursor.setDate(cursor.getDate() - 1);
  while (dates.length < dayCount) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates.reverse();
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * 30-min slots elapsed so far today ({ lastHour, lastMinute }); full day for
 * past dates. The campus simulates 24/7 — no weekday or business-hour limits.
 */
function slotLimitFor(date) {
  const now = new Date();
  if (!isSameDay(date, now)) return { lastHour: 23, lastMinute: 30 };
  return { lastHour: now.getHours(), lastMinute: now.getMinutes() >= 30 ? 30 : 0 };
}

/**
 * Directly generate `days` weekdays of meter/sensor history (no ML per tick),
 * then run the real prediction models for the most recent `predictionDays`.
 */
export async function generateBulkHistory({ days = 40, predictionDays = 3 } = {}) {
  const settings = await getSettings();
  const [rooms, buildingList] = await Promise.all([
    Classroom.find({}).lean(),
    Building.find({}).lean()
  ]);
  const codeMap = new Map(buildingList.map((b) => [b._id.toString(), b.code]));
  const buildingById = new Map(buildingList.map((b) => [b._id.toString(), b._id]));

  const dates = lastCalendarDates(days);
  const modelReady = mlService.isEnergyModelReady();
  const predictionDates = new Set(
    (modelReady ? dates.slice(-predictionDays) : []).map((d) => d.toDateString())
  );

  const readings = [];
  const occupancy = [];
  const predictionDocs = [];
  const lastRate = new Map();
  let predictionTicks = 0;

  for (const date of dates) {
    const academicDay = (date.getDay() + 6) % 7 + 1; // Mon=1..Sun=7 (real calendar)
    const wantedPrediction = predictionDates.has(date.toDateString());
    const { lastHour, lastMinute } = slotLimitFor(date);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    for (let hour = 0; hour <= lastHour; hour++) {
      const period = periodForHour(hour); // 0 = off-hours (24/7 campus)
      const minutes = hour === lastHour ? (lastMinute >= 30 ? [0, 30] : [0]) : [0, 30];

      for (const minute of minutes) {
        const timestamp = new Date(date);
        timestamp.setHours(hour, minute, 0, 0);
        const slotKey = `${hour}-${minute}`;
        const wantTickPrediction = wantedPrediction && minute === 0;

        const tickReadings = [];
        const contexts = [];

        for (const room of rooms) {
          const expected = expectedFor(room, period, academicDay);
          const present = presenceFor(room, period, academicDay, dateStr, expected);
          const scenario = scenarioFor(room.roomNumber);
          const forcedEmpty =
            scenario && scenario.effect === 'empty-room-appliances' && period >= 2 && period <= 6;

          let lights = present > 0 ? 'on' : 'off';
          let fans = present > 0 ? 'on' : 'off';
          if (forcedEmpty) {
            lights = 'on';
            fans = 'off';
          }

          const rng = seededRandom(`${room.roomNumber}-${dateStr}-${slotKey}`);
          let draw = computeRoomDraw({ ...room, lightStatus: lights, fanStatus: fans }, forcedEmpty ? 0 : present);
          let anomalous = false;
          // Demo anomalies whenever the room is actually occupied — day OR
          // evening/night batches — matching the live simulator.
          if (present > 0 && period >= 1 && scenario && scenario.effect === 'high-consumption') { draw *= scenario.multiplier; anomalous = true; }
          if (present > 0 && period >= 1 && scenario && scenario.effect === 'low-occupancy-high-energy') { draw *= scenario.multiplier; anomalous = true; }
          draw *= 0.93 + rng() * 0.14; // ±7% meter noise

          const prevRate = lastRate.get(room._id.toString()) || 0;
          lastRate.set(room._id.toString(), Number(draw.toFixed(3)));

          const energyConsumption = draw * INTERVAL_HOURS;
          const lightsOn = lights === 'on' ? room.numLights : 0;
          const fansOn = fans === 'on' ? room.numFans : 0;

          tickReadings.push({
            roomId: room._id,
            buildingId: buildingById.get(room.buildingId.toString()) || room.buildingId,
            timestamp,
            energyConsumption: Number(energyConsumption.toFixed(4)),
            power: Number(draw.toFixed(3)),
            hourlyRate: Number(draw.toFixed(3)),
            voltage: 230,
            current: Number(((draw * 1000) / 230).toFixed(2)),
            intervalMinutes: MINUTES_PER_TICK,
            occupancy: present,
            lightsOn,
            fansOn,
            applianceEnergy: Number((lightsOn * 0.014 + fansOn * 0.02) * INTERVAL_HOURS),
            potentialApplianceEnergy: Number((room.numLights * 0.014 + room.numFans * 0.02) * INTERVAL_HOURS),
            anomalous
          });
          occupancy.push({
            roomId: room._id,
            timestamp,
            expectedOccupancy: expected,
            actualOccupancy: forcedEmpty ? 0 : present,
            attendanceProbability: expected > 0 ? 0.85 : 0,
            source: 'dummy_attendance'
          });

          if (wantTickPrediction) {
            contexts.push({
              room: {
                ...room,
                buildingCode: codeMap.get(room.buildingId.toString()) || '',
                currentOccupancy: forcedEmpty ? 0 : present,
                lightStatus: lights,
                fanStatus: fans
              },
              hour,
              period,
              dayOfWeek: academicDay,
              historicalEnergy: prevRate,
              actualRate: draw,
              simTime: timestamp
            });
          }
        }

        readings.push(...tickReadings);

        if (wantTickPrediction && contexts.length) {
          try {
            const outputs = await predictionService.generatePredictionBatch(contexts, settings, { docSink: predictionDocs });
            await Classroom.bulkWrite(
              outputs.map((o) => ({
                updateOne: {
                  filter: { _id: o.roomId },
                  update: {
                    $set: {
                      predictedEnergy: o.predictedEnergy,
                      energyDifference: o.difference,
                      percentageDifference: o.percentageDifference,
                      status: o.status
                    }
                  }
                }
              }))
            );
            predictionTicks += 1;
          } catch (e) {
            console.warn('[bulk-history] prediction pass skipped:', e.message);
          }
        }
      }
    }
  }

  await EnergyReading.insertMany(readings, { ordered: false });
  await OccupancyReading.insertMany(occupancy, { ordered: false });
  if (predictionDocs.length) await Prediction.insertMany(predictionDocs, { ordered: false });

  // Final classroom "now" state = last 30-min slot of the most recent history day.
  const lastReading = (roomId) => readings
    .slice()
    .reverse()
    .find((r) => String(r.roomId) === String(roomId));

  await Classroom.bulkWrite(
    rooms.map((room) => {
      const r = lastReading(room._id);
      const occ = occupancy
        .slice()
        .reverse()
        .find((o) => String(o.roomId) === String(room._id));
      const expected = occ ? occ.expectedOccupancy : 0;
      const present = occ ? occ.actualOccupancy : 0;
      return {
        updateOne: {
          filter: { _id: room._id },
          update: {
            $set: {
              currentOccupancy: present,
              expectedOccupancy: expected,
              presenceDetected: present > 0,
              lightStatus: r && r.lightsOn > 0 ? 'on' : 'off',
              fanStatus: r && r.fansOn > 0 ? 'on' : 'off',
              currentEnergy: r ? r.hourlyRate : 0
            }
          }
        }
      };
    })
  );

  // Deterministic alert + recommendation pass from the final predicted state.
  if (modelReady) {
    const alerted = [];
    for (const room of rooms) {
      try {
        const fresh = await Classroom.findById(room._id).populate('facultyId');
        await alertService.generateAlertsForRoom(fresh, settings);
        const recs = await recommendationService.applyRecommendations(fresh, settings);
        if (recs.length) alerted.push(room.roomNumber);
      } catch (e) {
        console.warn(`[bulk-history] alert/recommendation for ${room.roomNumber}:`, e.message);
      }
    }
    console.log(`Bulk history: alerts generated, recommendation rooms -> ${alerted.join(', ') || 'none'}`);
  }

  return {
    days,
    readings: readings.length,
    occupancy: occupancy.length,
    predictionTicks,
    predictions: modelReady ? predictionTicks * rooms.length : 0,
    alerts: await Alert.countDocuments(),
    recommendations: await Recommendation.countDocuments()
  };
}

export default { generateBulkHistory };