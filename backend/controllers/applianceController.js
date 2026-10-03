import asyncHandler from '../utils/asyncHandler.js';
import Classroom from '../models/Classroom.js';
import EnergyReading from '../models/EnergyReading.js';

export const getAppliances = asyncHandler(async (req, res) => {
  const rooms = await Classroom.find({})
    .populate('buildingId', 'name code')
    .populate('facultyId', 'name')
    .sort({ roomNumber: 1 })
    .lean();

  const readings = await EnergyReading.find({})
    .sort({ timestamp: -1 })
    .limit(rooms.length)
    .lean();
  const savingsByRoom = {};
  readings.forEach((r) => {
    const key = r.roomId.toString();
    savingsByRoom[key] = Math.max(0, (r.potentialApplianceEnergy || 0) - (r.applianceEnergy || 0));
  });

  let totalActiveLights = 0;
  let totalActiveFans = 0;
  const byStatus = { on: 0, off: 0 };
  rooms.forEach((r) => {
    totalActiveLights += r.lightStatus === 'on' ? 1 : 0;
    totalActiveFans += r.fanStatus === 'on' ? 1 : 0;
    byStatus[r.lightStatus === 'on' && r.fanStatus === 'on' ? 'on' : 'off'] += 1;
  });

  res.json({
    summary: {
      totalRooms: rooms.length,
      activeLights: totalActiveLights,
      activeFans: totalActiveFans,
      automaticOff: rooms.filter((r) => r.currentOccupancy <= 0 && r.lightStatus === 'off' && r.fanStatus === 'off').length,
      potentialIssue: rooms.filter((r) => r.currentOccupancy <= 0 && (r.lightStatus === 'on' || r.fanStatus === 'on')).length
    },
    rooms: rooms.map((r) => ({
      ...r,
      savingNow: Number((savingsByRoom[r._id.toString()] || 0).toFixed(4))
    }))
  });
});

export default { getAppliances };