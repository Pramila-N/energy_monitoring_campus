import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Classroom from '../models/Classroom.js';
import EnergyReading from '../models/EnergyReading.js';
import energyService from '../services/energyService.js';

function buildFilter(query) {
  const filter = {};
  if (query.building) filter.buildingId = query.building;
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.q) filter.roomNumber = { $regex: String(query.q).trim(), $options: 'i' };
  return filter;
}

export const listClassrooms = asyncHandler(async (req, res) => {
  const filter = buildFilter(req.query);
  const rooms = await Classroom.find(filter)
    .populate('buildingId', 'name code')
    .populate('facultyId', 'name phoneNumber email')
    .sort({ roomNumber: 1 })
    .lean();

  const roomIds = rooms.map((r) => r._id);
  const energyByRoom = roomIds.length
    ? await EnergyReading.aggregate([
        { $match: { roomId: { $in: roomIds } } },
        { $group: { _id: '$roomId', energy: { $sum: '$energyConsumption' }, count: { $sum: 1 } } }
      ])
    : [];
  const map = new Map(energyByRoom.map((e) => [e._id.toString(), e]));

  const withEnergy = rooms.map((r) => ({
    ...r,
    totalEnergy: Number((map.get(r._id.toString())?.energy || 0).toFixed(2)),
    readings: map.get(r._id.toString())?.count || 0
  }));

  res.json({ classrooms: withEnergy });
});

export const getClassroom = asyncHandler(async (req, res) => {
  const room = await Classroom.findById(req.params.id)
    .populate('buildingId', 'name code floors')
    .populate('facultyId', 'name employeeId phoneNumber email department')
    .lean();
  if (!room) throw new ApiError(404, 'Classroom not found.');

  const recentReadings = await EnergyReading.find({ roomId: room._id })
    .sort({ timestamp: 1 })
    .limit(60)
    .lean();

  const series = recentReadings.map((r) => ({
    timestamp: r.timestamp,
    energy: r.energyConsumption,
    hourlyRate: r.hourlyRate,
    occupancy: r.occupancy,
    anomalous: r.anomalous
  }));

  const hourly = await EnergyReading.aggregate([
    { $match: { roomId: room._id } },
    {
      $group: {
        _id: {
          y: { $year: '$timestamp' },
          m: { $month: '$timestamp' },
          d: { $dayOfMonth: '$timestamp' },
          h: { $hour: '$timestamp' }
        },
        energy: { $sum: '$energyConsumption' }
      }
    },
    { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1, '_id.h': 1 } }
  ]);

  res.json({
    classroom: room,
    series,
    hourly: hourly.map((h) => ({
      label: `${String(h._id.d).padStart(2, '0')}/${String(h._id.h).padStart(2, '0')}h`,
      energy: Number(h.energy.toFixed(3))
    }))
  });
});

export default { listClassrooms, getClassroom };