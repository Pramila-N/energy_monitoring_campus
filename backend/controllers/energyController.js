import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Classroom from '../models/Classroom.js';
import EnergyReading from '../models/EnergyReading.js';
import energyService from '../services/energyService.js';

const LOCAL_TZ = localTimezoneString();

function localTimezoneString() {
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export const getReadings = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.roomId) filter.roomId = req.query.roomId;
  if (req.query.buildingId) filter.buildingId = req.query.buildingId;
  if (req.query.source) filter.source = req.query.source;
  if (req.query.from) filter.timestamp = { $gte: new Date(req.query.from) };
  if (req.query.to) filter.timestamp = { ...(filter.timestamp || {}), $lte: new Date(req.query.to) };

  const limit = Math.min(Number(req.query.limit || 200), 2000);

  // Aggregate into fixed time buckets (hourly/daily) to keep chart payloads tiny.
  if (req.query.bucket) {
    const gid = { $dateToString: { format: req.query.bucket === 'day' ? '%Y-%m-%d' : '%Y-%m-%d %H:00', date: '$timestamp', timezone: LOCAL_TZ } };
    const rows = await EnergyReading.aggregate([
      { $match: filter },
      { $group: { _id: gid, energy: { $sum: '$energyConsumption' }, anomalous: { $sum: { $cond: ['$anomalous', 1, 0] } }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: limit },
      { $sort: { _id: 1 } }
    ]);
    return res.json({ readings: rows, bucketed: true, bucket: req.query.bucket });
  }

  const readings = await EnergyReading.find(filter)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('roomId', 'roomNumber type')
    .lean();
  res.json({ readings });
});

export const getRoomEnergy = asyncHandler(async (req, res) => {
  const room = await Classroom.findById(req.params.roomId);
  if (!room) throw new ApiError(404, 'Classroom not found.');
  const readings = await EnergyReading.find({ roomId: room._id }).sort({ timestamp: -1 }).limit(100).lean();
  res.json({
    classroom: { roomNumber: room.roomNumber, name: room.name, currentEnergy: room.currentEnergy },
    readings: readings.map((r) => ({
      timestamp: r.timestamp,
      energy: r.energyConsumption,
      hourlyRate: r.hourlyRate,
      power: r.power,
      voltage: r.voltage,
      current: r.current,
      occupancy: r.occupancy,
      anomalous: r.anomalous,
      source: r.source
    }))
  });
});

export const getEnergySeries = asyncHandler(async (req, res) => {
  const hours = Math.min(Number(req.query.hours || 24), 168);
  const data = await energyService.energySeries(req.params.roomId, hours);
  res.json({ series: data, hours });
});

export default { getReadings, getRoomEnergy, getEnergySeries };