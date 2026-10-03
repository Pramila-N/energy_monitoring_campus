import Alert from '../models/Alert.js';
import Faculty from '../models/Faculty.js';
import { classifyDifference, severityForDifference, existingActiveAlert } from './anomalyService.js';

export async function generateAlertsForRoom(room, settings) {
  const created = [];
  const abnormalPct = settings?.anomaly?.abnormalPct ?? 20;
  const pct = room.percentageDifference || 0;
  const occupancy = room.currentOccupancy || 0;

  const faculty = room.facultyId ? await Faculty.findById(room.facultyId).catch(() => null) : null;
  const facultyName = faculty?.name || room.assignedFaculty || '';

  const maybeCreate = async (type, severity, message) => {
    const existing = await existingActiveAlert(room._id, type);
    if (existing) return;
    await Alert.create({
      roomId: room._id,
      buildingId: room.buildingId,
      type,
      severity,
      message,
      actualEnergy: Number(room.currentEnergy || 0),
      predictedEnergy: Number(room.predictedEnergy || 0),
      percentageDifference: Number(pct),
      occupancy,
      facultyId: room.facultyId || null,
      facultyName
    });
    created.push({ roomId: room._id, type });
  };

  // 1. Excess energy vs AI prediction
  if (pct > abnormalPct && occupancy > 0) {
    await maybeCreate(
      'EXCESS_ENERGY',
      severityForDifference(pct),
      `Energy consumption is ${Math.round(pct)}% higher than predicted in ${room.roomNumber}.`
    );
  }

  // 2. Very high absolute consumption regardless of prediction
  if (room.currentEnergy >= 5 && occupancy > 0) {
    await maybeCreate(
      'HIGH_CONSUMPTION',
      'high',
      `High absolute consumption detected (${room.currentEnergy.toFixed(1)} kWh) in ${room.roomNumber}.`
    );
  }

  // 3. Appliances running while the room is empty
  if (occupancy <= 0 && (room.lightStatus === 'on' || room.fanStatus === 'on')) {
    const what = [];
    if (room.lightStatus === 'on') what.push('lights');
    if (room.fanStatus === 'on') what.push('fans');
    await maybeCreate(
      'EMPTY_ROOM_APPLIANCES',
      room.lightStatus === 'on' && room.fanStatus === 'on' ? 'high' : 'medium',
      `${room.roomNumber} is unoccupied but ${what.join(' and ')} are still ON.`
    );
  }

  return created;
}

export async function contactAlert(id) {
  const alert = await Alert.findById(id);
  if (!alert) return null;
  if (alert.status === 'resolved') return alert;
  alert.status = 'contacted';
  alert.contactAt = new Date();
  await alert.save();
  return alert;
}

export async function resolveAlert(id, note = '') {
  const alert = await Alert.findById(id);
  if (!alert) return null;
  alert.status = 'resolved';
  alert.resolvedAt = new Date();
  alert.resolutionNote = note || alert.resolutionNote;
  await alert.save();
  return alert;
}

export async function listAlerts(filter = {}, limit = 200) {
  return Alert.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('roomId', 'roomNumber name type')
    .populate('buildingId', 'name code');
}

export default { generateAlertsForRoom, contactAlert, resolveAlert, listAlerts };