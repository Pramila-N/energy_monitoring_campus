import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Building from '../models/Building.js';
import Classroom from '../models/Classroom.js';
import EnergyReading from '../models/EnergyReading.js';

export const listBuildings = asyncHandler(async (req, res) => {
  const buildings = await Building.find({}).sort({ code: 1 }).lean();
  const withStats = await Promise.all(
    buildings.map(async (b) => {
      const rooms = await Classroom.find({ buildingId: b._id }).lean();
      const energy = await EnergyReading.aggregate([
        { $match: { buildingId: b._id } },
        { $group: { _id: null, total: { $sum: '$energyConsumption' }, count: { $sum: 1 } } }
      ]);
      return {
        ...b,
        totalRooms: rooms.length,
        occupiedRooms: rooms.filter((r) => r.currentOccupancy > 0).length,
        abnormalRooms: rooms.filter((r) => r.status === 'abnormal').length,
        energyToday: Number((energy[0]?.total || 0).toFixed(2)),
        readings: energy[0]?.count || 0
      };
    })
  );
  res.json({ buildings: withStats });
});

export const getBuilding = asyncHandler(async (req, res) => {
  const building = await Building.findById(req.params.id);
  if (!building) throw new ApiError(404, 'Building not found.');
  const rooms = await Classroom.find({ buildingId: building._id })
    .populate('facultyId', 'name phoneNumber')
    .lean();
  const energyByRoom = await EnergyReading.aggregate([
    { $match: { buildingId: building._id } },
    { $group: { _id: '$roomId', energy: { $sum: '$energyConsumption' } } },
    { $sort: { energy: -1 } }
  ]);
  const roomEnergyMap = new Map(energyByRoom.map((e) => [e._id.toString(), Number(e.energy.toFixed(2))]));
  const roomsWithEnergy = rooms.map((r) => ({ ...r, totalEnergy: roomEnergyMap.get(r._id.toString()) || 0 }));
  res.json({ building, rooms: roomsWithEnergy });
});

export default { listBuildings, getBuilding };