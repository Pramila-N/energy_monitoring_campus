import mlService from './mlService.js';
import Prediction from '../models/Prediction.js';
import EnergyReading from '../models/EnergyReading.js';
import ApiError from '../utils/ApiError.js';
import { classifyDifference } from './anomalyService.js';

/**
 * Build energy-model features for a room following the exact schema used by
 * ml/data/training_data.csv (see ML section). 'actual_energy' is NEVER passed
 * as a feature (avoids data leakage); only 'historical_energy' (a lag feature)
 * is used.
 */
export function buildEnergyFeatures({ room, hour, period, dayOfWeek, historicalEnergy }) {
  return {
    room_id: room.roomNumber,
    building: room.buildingCode || '',
    room_type: room.type,
    hour: Number(hour),
    period: Number(period),
    day_of_week: Number(dayOfWeek),
    occupancy: Math.round(Number(room.currentOccupancy || 0)),
    capacity: Number(room.capacity || 0),
    lights_on: room.lightStatus === 'on' ? 1 : 0,
    fans_on: room.fanStatus === 'on' ? 1 : 0,
    historical_energy: Number(historicalEnergy || 0)
  };
}

export async function latestReadingRate(roomId) {
  const last = await EnergyReading.findOne({ roomId }).sort({ timestamp: -1 }).lean();
  return last ? last.hourlyRate : 0;
}

export async function historicalEnergyRate(roomId, hours = 3) {
  const since = new Date(Date.now() - hours * 3600 * 1000);
  const rows = await EnergyReading.find({ roomId, timestamp: { $gte: since } })
    .sort({ timestamp: -1 })
    .limit(6)
    .select('hourlyRate')
    .lean();
  if (rows.length === 0) return 0;
  const sum = rows.reduce((acc, r) => acc + (r.hourlyRate || 0), 0);
  return Number((sum / rows.length).toFixed(4));
}

/**
 * Generate and persist energy predictions for a batch of rooms.
 * `rooms` = array of { room, hour, period, dayOfWeek, historicalEnergy, actualRate, simTime }
 * Returns per-room results aligned by original order.
 */
export async function generatePredictionBatch(roomContexts, settings) {
  if (!mlService.isEnergyModelReady()) {
    throw new ApiError(
      503,
      'Energy model is not trained. Run `python ml/scripts/train_model.py` first.'
    );
  }

  const requests = roomContexts.map((r) => ({ record: buildEnergyFeatures(r), ctx: r }));
  const result = await mlService.predictEnergyBatch(requests.map((x) => x.record));
  const predictions = result.predictions ?? result;

  const outputs = [];
  for (let i = 0; i < requests.length; i++) {
    const { record, ctx } = requests[i];
    const pred = predictions[i] || {};
    const predicted = Math.max(0, Number(pred.predicted_energy || 0));
    const actual = Number(ctx.actualRate || 0);
    const diff = actual - predicted;
    const pct = predicted > 0 ? (diff / predicted) * 100 : 0;

    await Prediction.create({
      roomId: ctx.room._id,
      timestamp: ctx.simTime || new Date(),
      period: record.period,
      predictedEnergy: Number(predicted.toFixed(3)),
      actualEnergy: Number(actual.toFixed(3)),
      difference: Number(diff.toFixed(3)),
      percentageDifference: Number(pct.toFixed(1)),
      modelVersion: pred.model_version || 'energy-v1',
      confidence: Number(pred.confidence || 0),
      occupancy: record.occupancy,
      status: classifyDifference(pct, settings),
      features: {
        building: record.building,
        room_type: record.room_type,
        hour: record.hour,
        occupancy: record.occupancy,
        lights_on: record.lights_on,
        fans_on: record.fans_on,
        historical_energy: record.historical_energy
      }
    });

    outputs.push({
      roomId: ctx.room._id,
      roomNumber: ctx.room.roomNumber,
      predictedEnergy: Number(predicted.toFixed(3)),
      actualEnergy: Number(actual.toFixed(3)),
      difference: Number(diff.toFixed(3)),
      percentageDifference: Number(pct.toFixed(1)),
      status: classifyDifference(pct, settings),
      confidence: Number(pred.confidence || 0)
    });
  }
  return outputs;
}

export async function getRecentPredictions(filter = {}, limit = 50) {
  return Prediction.find(filter)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('roomId', 'roomNumber name');
}

export default {
  buildEnergyFeatures,
  latestReadingRate,
  historicalEnergyRate,
  generatePredictionBatch,
  getRecentPredictions
};