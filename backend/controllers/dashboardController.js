import asyncHandler from '../utils/asyncHandler.js';
import Building from '../models/Building.js';
import Classroom from '../models/Classroom.js';
import EnergyReading from '../models/EnergyReading.js';
import Alert from '../models/Alert.js';
import energyService from '../services/energyService.js';
import mlService from '../services/mlService.js';
import { getSimStatus } from '../services/simulationService.js';

const TODAY = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getSummary = asyncHandler(async (req, res) => {
  const [totalToday, savedToday, alerts, rooms, buildings, ml] = await Promise.all([
    energyService.totalEnergySince(TODAY()),
    energyService.energySavedSince(TODAY()),
    Alert.find({ status: { $in: ['active', 'contacted'] } }).sort({ createdAt: -1 }).limit(8).lean(),
    Classroom.find({}).populate('buildingId', 'name code').populate('facultyId', 'name phoneNumber').lean(),
    Building.find({}).lean(),
    mlService.modelStatus()
  ]);

  const abnormalRooms = rooms.filter((r) => r.status === 'abnormal').length;
  const activeRooms = rooms.filter((r) => r.currentOccupancy > 0).length;
  const activeLights = rooms.filter((r) => r.lightStatus === 'on').length;
  const activeFans = rooms.filter((r) => r.fanStatus === 'on').length;

  const chartRange = await Promise.all(
    rooms.map(async (r) => {
      const last = await EnergyReading.findOne({ roomId: r._id }).sort({ timestamp: -1 }).lean();
      return last;
    })
  );

  const actualLast = chartRange.reduce((sum, r) => sum + (r ? r.hourlyRate : 0), 0);
  const predictedSum = rooms.reduce((sum, r) => sum + (r.predictedEnergy || 0), 0);

  res.json({
    summary: {
      totalEnergyToday: totalToday.total,
      readingsToday: totalToday.count,
      energySavedToday: savedToday,
      activeRooms,
      abnormalRooms,
      activeLights,
      activeFans,
      healthyRooms: rooms.length - abnormalRooms,
      totalRooms: rooms.length,
      actualRateNow: Number(actualLast.toFixed(2)),
      predictedRateNow: Number(predictedSum.toFixed(2))
    },
    rooms,
    buildings,
    alerts,
    modelStatus: ml,
    simulation: getSimStatus()
  });
});

export const getInsights = asyncHandler(async (req, res) => {
  const abnormal = await Classroom.find({ status: 'abnormal' })
    .populate('buildingId', 'name code')
    .populate('facultyId', 'name')
    .lean();
  const emptyWithAppliances = await Classroom.find({
    currentOccupancy: { $lte: 0 },
    $or: [{ lightStatus: 'on' }, { fanStatus: 'on' }]
  }).lean();
  const topConsumers = await EnergyReading.aggregate([
    { $match: { timestamp: { $gte: TODAY() } } },
    { $group: { _id: '$roomId', energy: { $sum: '$energyConsumption' } } },
    { $sort: { energy: -1 } },
    { $limit: 5 }
  ]);
  const rooms = await Classroom.find({ _id: { $in: topConsumers.map((t) => t._id) } }).lean();
  const roomMap = new Map(rooms.map((r) => [r._id.toString(), r]));

  const insights = [];

  if (abnormal.length > 0) {
    insights.push({
      type: 'warning',
      title: `${abnormal.length} room(s) consuming more than predicted`,
      detail: abnormal.map((r) => `${r.roomNumber} (+${Math.round(r.percentageDifference)}% vs predicted)`).join(', ')
    });
  } else {
    insights.push({ type: 'success', title: 'All rooms within expected consumption', detail: 'No anomalies detected in the latest prediction pass.' });
  }

  if (emptyWithAppliances.length > 0) {
    insights.push({
      type: 'warning',
      title: `${emptyWithAppliances.length} empty room(s) with appliances still ON`,
      detail: emptyWithAppliances.map((r) => `${r.roomNumber} (${r.lightStatus === 'on' ? 'Lights' : ''}${r.lightStatus === 'on' && r.fanStatus === 'on' ? ' + ' : ''}${r.fanStatus === 'on' ? 'Fans' : ''})`).join(', ')
    });
  }

  const totalCon = topConsumers.reduce((s, t) => s + t.energy, 0);
  if (topConsumers.length > 0) {
    const top = topConsumers[0];
    const room = roomMap.get(top._id.toString());
    insights.push({
      type: 'info',
      title: `${room ? room.roomNumber : 'A lab'} leads today's consumption`,
      detail: `${Number(top.energy.toFixed(2))} kWh so far — ${room ? (room.currentOccupancy > 0 ? `currently ${room.currentOccupancy} occupants` : 'currently empty') : ''}`
    });
  }

  res.json({ insights: insights.slice(0, 6) });
});

export default { getSummary, getInsights };