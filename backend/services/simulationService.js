import Classroom from '../models/Classroom.js';
import Building from '../models/Building.js';
import EnergyReading from '../models/EnergyReading.js';
import Faculty from '../models/Faculty.js';
import { getSettings } from './settingsService.js';
import mlService from './mlService.js';
import predictionService from './predictionService.js';
import occupancyService from './occupancyService.js';
import alertService from './alertService.js';
import recommendationService from './recommendationService.js';
import anomalyService from './anomalyService.js';
import env from '../config/env.js';
import { computeRoomDraw, LIGHT_DRAW_KW, FAN_DRAW_KW } from '../mock-data/energyProfile.js';
import { isRoomScheduled, getScheduleFor, getExpectedOccupancyByRate, periodForHour } from '../mock-data/timetable.js';
import { scenarioFor } from '../mock-data/scenarios.js';
import { facultyAttendanceFactor } from '../mock-data/occupancy.js';

const state = {
  running: false,
  autoStart: true,
  ticking: false,
  lastTick: null,
  tickCount: 0,
  simClock: new Date(),
  simDay: 0,
  simIntervalMs: env.simIntervalMs,
  simMinutesPerTick: env.simMinutesPerTick,
  energyError: null,
  occupancyError: null,
  timer: null
};

function normalizeSimClock() {
  const now = new Date();
  const normalized = new Date(now);
  const h = normalized.getHours();
  if (h < 9) normalized.setHours(9, 30, 0, 0);
  if (h >= 17) {
    normalized.setDate(normalized.getDate());
    normalized.setHours(9, 30, 0, 0);
  }
  return normalized;
}

export function getSimStatus() {
  return {
    running: state.running,
    tickCount: state.tickCount,
    lastTick: state.lastTick,
    simClock: state.simClock,
    simDay: state.simDay,
    intervalMs: state.simIntervalMs,
    minutesPerTick: state.simMinutesPerTick,
    models: mlService.modelStatus(),
    energyModelReady: mlService.isEnergyModelReady(),
    occupancyModelReady: mlService.isOccupancyModelReady(),
    energyError: state.energyError,
    occupancyError: state.occupancyError
  };
}

export function startSimulation(intervalMs) {
  if (state.timer) return getSimStatus();
  if (intervalMs && intervalMs >= 2000) state.simIntervalMs = intervalMs;
  state.running = true;
  state.timer = setInterval(() => runTick().catch((e) => console.error('[sim] tick error', e)), state.simIntervalMs);
  state.simClock = normalizeSimClock();
  console.log(`[sim] simulation started (tick every ${state.simIntervalMs}ms, ${state.simMinutesPerTick} min/tick)`);
  return getSimStatus();
}

export function stopSimulation() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.running = false;
  return getSimStatus();
}

export function setSimulationSpeed(intervalMs) {
  if (intervalMs && intervalMs >= 2000) state.simIntervalMs = intervalMs;
  if (state.running) {
    clearInterval(state.timer);
    state.timer = setInterval(() => runTick().catch((e) => console.error('[sim] tick error', e)), state.simIntervalMs);
  }
  return getSimStatus();
}

async function buildingCodeMap() {
  const buildings = await Building.find({}).lean();
  const map = {};
  buildings.forEach((b) => {
    map[b._id.toString()] = b.code;
  });
  return map;
}

/** Reproduce the same expected-occupancy derivation the ML pipeline uses. */
function expectedFor(room, period, academicDay) {
  const isStaff = room.type === 'staff_room';
  if (isStaff) return 6 + (academicDay % 3);
  if (!isRoomScheduled(room.roomNumber, academicDay, period)) return 0;
  return Math.max(4, Math.round(room.capacity * (getExpectedOccupancyByRate(room.roomNumber) || 0.7)));
}

function advanceClock(minutes) {
  const next = new Date(state.simClock.getTime() + minutes * 60 * 1000);
  state.simClock = next;
  if (next.getHours() === 0 && next.getMinutes() < minutes) {
    state.simDay = (state.simDay + 1) % 5;
  }
  return next;
}

async function updateOccupancyAndAppliances(rooms, period, academicDay, buildingCodes) {
  const contexts = rooms.map((room) => ({
    room,
    period,
    expectedOccupancy: expectedFor(room, period, academicDay)
  }));

  let predictions;
  try {
    predictions = await occupancyService.predictOccupancyBatch(
      contexts.map((c) => occupancyService.buildOccupancyFeatures({
        room: c.room,
        dayOfWeek: academicDay,
        period,
        expectedOccupancy: c.expectedOccupancy
      }))
    );
    state.occupancyError = null;
  } catch (e) {
    state.occupancyError = e.message;
    predictions = [];
  }

  const updates = [];
  for (let i = 0; i < contexts.length; i++) {
    const { room, period: p, expectedOccupancy } = contexts[i];
    const pred = predictions[i];
    let present = pred ? Math.round(pred.predicted_present) : 0;

    const scenario = scenarioFor(room.roomNumber);
    const forcedEmptyPeriods =
      scenario && scenario.effect === 'empty-room-appliances' && p >= 2 && p <= 6;
    if (forcedEmptyPeriods) present = 0;

    const presence = present > 0;
    let lights = presence ? 'on' : 'off';
    let fans = presence ? 'on' : 'off';
    if (forcedEmptyPeriods) {
      lights = 'on';
      fans = 'off';
    }

    await occupancyService.recordOccupancy(
      room._id,
      expectedOccupancy,
      present,
      pred ? Number(pred.attendance_probability || 0) : 0
    );

    updates.push({
      room,
      present,
      expectedOccupancy,
      presenceDetected: presence,
      lights,
      fans,
      scenario
    });
  }
  return updates;
}

async function recordEnergyReadings(updates, buildingCodes, simTime, intervalHours) {
  const readings = [];
  for (const u of updates) {
    const { room, present, lights, fans } = u;
    let draw = computeRoomDraw({ ...room, lightStatus: lights, fanStatus: fans }, present);

    const scenario = u.scenario;
    let anomalous = false;
    if (scenario && scenario.effect === 'high-consumption') {
      draw *= scenario.multiplier;
      anomalous = true;
    }
    if (scenario && scenario.effect === 'low-occupancy-high-energy') {
      draw *= scenario.multiplier;
      anomalous = true;
    }
    draw *= 0.93 + Math.random() * 0.14; // ±7% meter noise

    const energyConsumption = draw * intervalHours;
    const appliance = {
      lights: lights === 'on' ? room.numLights : 0,
      fans: fans === 'on' ? room.numFans : 0
    };
    const applianceEnergy = (appliance.lights * LIGHT_DRAW_KW + appliance.fans * FAN_DRAW_KW) * intervalHours;
    const potentialApplianceEnergy = (room.numLights * LIGHT_DRAW_KW + room.numFans * FAN_DRAW_KW) * intervalHours;

    readings.push({
      roomId: room._id,
      buildingId: room.buildingId,
      timestamp: simTime,
      energyConsumption: Number(energyConsumption.toFixed(4)),
      power: Number(draw.toFixed(3)),
      hourlyRate: Number(draw.toFixed(3)),
      voltage: 230,
      current: Number(((draw * 1000) / 230).toFixed(2)),
      intervalMinutes: state.simMinutesPerTick,
      occupancy: present,
      lightsOn: appliance.lights,
      fansOn: appliance.fans,
      applianceEnergy: Number(applianceEnergy.toFixed(4)),
      potentialApplianceEnergy: Number(potentialApplianceEnergy.toFixed(4)),
      anomalous
    });
  }
  await EnergyReading.insertMany(readings);
  return readings;
}

async function updateClassroomFields(updates, readings) {
  for (let i = 0; i < updates.length; i++) {
    const { room, present, expectedOccupancy, presenceDetected, lights, fans } = updates[i];
    const reading = readings[i];
    await Classroom.updateOne(
      { _id: room._id },
      {
        $set: {
          currentOccupancy: present,
          expectedOccupancy,
          presenceDetected,
          lightStatus: lights,
          fanStatus: fans,
          currentEnergy: reading.hourlyRate
        }
      }
    );
  }
}

async function runPredictionPass(rooms, buildingCodes, simTime) {
  const hour = state.simClock.getHours();
  try {
    const contexts = [];
    for (const room of rooms) {
      const hist = await predictionService.historicalEnergyRate(room._id, 3);
      const last = await EnergyReading.findOne({ roomId: room._id }).sort({ timestamp: -1 }).lean();
      contexts.push({
        room: {
          ...room,
          buildingCode: buildingCodes[room.buildingId.toString()] || ''
        },
        hour,
        period: Math.max(1, Math.min(8, hour - 8)),
        dayOfWeek: state.simDay + 1,
        historicalEnergy: hist,
        actualRate: last ? last.hourlyRate : 0,
        simTime
      });
    }
    const outputs = await predictionService.generatePredictionBatch(contexts, await getSettings());

    const map = new Map(outputs.map((o) => [o.roomId.toString(), o]));
    await Classroom.bulkWrite(
      rooms.map((room) => {
        const o = map.get(room._id.toString());
        return {
          updateOne: {
            filter: { _id: room._id },
            update: {
              $set: {
                predictedEnergy: o?.predictedEnergy ?? 0,
                energyDifference: o?.difference ?? 0,
                percentageDifference: o?.percentageDifference ?? 0,
                status: o?.status ?? 'normal'
              }
            }
          }
        };
      })
    );
    state.energyError = null;
    return map;
  } catch (e) {
    state.energyError = e.message;
    console.error('[sim] prediction pass failed:', e.message);
    return null;
  }
}

async function runAlertAndRecommendationPass(rooms, settings) {
  for (const room of rooms) {
    try {
      const fresh = await Classroom.findById(room._id).populate('facultyId');
      await alertService.generateAlertsForRoom(fresh, settings);
      await recommendationService.applyRecommendations(fresh, settings);
    } catch (e) {
      console.error(`[sim] alert/recommendation for ${room.roomNumber} failed:`, e.message);
    }
  }
}

/** One full simulation tick. */
export async function runTick() {
  if (state.ticking) return;
  state.ticking = true;
  try {
    const settings = await getSettings();
    const simTime = advanceClock(state.simMinutesPerTick);
    const period = periodForHour(simTime.getHours());
    const academicDay = state.simDay + 1;
    const buildingCodes = await buildingCodeMap();
    let rooms = await Classroom.find({}).lean();

    // Evening/night: simulate idle campus.
    if (!period) {
      rooms = rooms.map((r) => ({ ...r, currentOccupancy: 0, lightStatus: 'off', fanStatus: 'off', presenceDetected: false }));
    }

    const updates = await updateOccupancyAndAppliances(rooms, period, academicDay, buildingCodes);
    const readings = await recordEnergyReadings(updates, buildingCodes, simTime, state.simMinutesPerTick / 60);
    await updateClassroomFields(updates, readings);

    const result = await runPredictionPass(await Classroom.find({}).lean(), buildingCodes, simTime);
    if (result) {
      await runAlertAndRecommendationPass(rooms, settings);
    }

    state.lastTick = new Date();
    state.tickCount += 1;
  } finally {
    state.ticking = false;
  }
}

/** Run several simulated ticks back-to-back (used by the seed history generator). */
export async function runTicksForHistory(count) {
  for (let i = 0; i < count; i++) {
    if (i % 5 === 0) process.stdout.write(`history tick ${i + 1}/${count}\n`);
    await runTick();
  }
}

export async function initializeSimulation() {
  state.simClock = normalizeSimClock();
  if (state.autoStart) {
    startSimulation(state.simIntervalMs);
  } else {
    stopSimulation();
  }
  return getSimStatus();
}

export default {
  state,
  getSimStatus,
  startSimulation,
  stopSimulation,
  setSimulationSpeed,
  runTick,
  runTicksForHistory,
  initializeSimulation
};