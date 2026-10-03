import asyncHandler from '../utils/asyncHandler.js';
import Building from '../models/Building.js';
import Classroom from '../models/Classroom.js';
import EnergyReading from '../models/EnergyReading.js';
import predictionService from '../services/predictionService.js';
import mlService from '../services/mlService.js';
import { getSettings } from '../services/settingsService.js';

export const getPredictions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.roomId) filter.roomId = req.query.roomId;
  if (req.query.status) filter.status = req.query.status;
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const predictions = await predictionService.getRecentPredictions(filter, limit);
  res.json({ predictions });
});

export const getMetrics = asyncHandler(async (req, res) => {
  res.json({
    energy: mlService.getEnergyMetrics(),
    occupancy: mlService.getOccupancyMetrics(),
    modelStatus: mlService.modelStatus()
  });
});

export const generatePredictions = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const [rooms, buildingList] = await Promise.all([
    Classroom.find({}).lean(),
    Building.find({}).lean()
  ]);
  const codeMap = new Map(buildingList.map((b) => [b._id.toString(), b.code]));

  const contexts = [];
  for (const room of rooms) {
    const [hist, last] = await Promise.all([
      predictionService.historicalEnergyRate(room._id, 3),
      EnergyReading.findOne({ roomId: room._id }).sort({ timestamp: -1 }).lean()
    ]);
    contexts.push({
      room: { ...room, buildingCode: codeMap.get(room.buildingId.toString()) || '' },
      hour: new Date().getHours(),
      period: Math.max(1, Math.min(8, new Date().getHours() - 8)),
      dayOfWeek: new Date().getDay(),
      historicalEnergy: hist,
      actualRate: last ? last.hourlyRate : 0,
      simTime: new Date()
    });
  }

  const outputs = await predictionService.generatePredictionBatch(contexts, settings);

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

  res.json({ message: `Generated ${outputs.length} predictions.`, generated: outputs.length });
});

export const getMLStatus = asyncHandler(async (req, res) => {
  res.json({
    modelStatus: mlService.modelStatus(),
    metrics: {
      energy: mlService.getEnergyMetrics(),
      occupancy: mlService.getOccupancyMetrics()
    }
  });
});

export default { getPredictions, getMetrics, generatePredictions, getMLStatus };