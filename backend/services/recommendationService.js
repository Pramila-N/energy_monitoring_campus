import Recommendation from '../models/Recommendation.js';
import Alert from '../models/Alert.js';
import { classifyDifference } from './anomalyService.js';
import { ROOM_TYPE_LABELS } from '../mock-data/energyProfile.js';

/**
 * Rule-based recommendation engine.
 * Considers: room type, occupancy, expected vs actual energy, appliance state
 * and historical/lab context so it never fires false alarms for labs whose
 * high consumption is natural.
 */
export function buildRecommendationForRoom(room, settings) {
  const recs = [];
  const occupancy = room.currentOccupancy || 0;
  const lights = room.lightStatus === 'on';
  const fans = room.fanStatus === 'on';
  const capacity = room.capacity || 1;
  const pct = room.percentageDifference || 0;
  const abnormalPct = settings?.anomaly?.abnormalPct ?? 20;
  const warningPct = settings?.anomaly?.warningPct ?? 10;
  const empty = occupancy <= 0;
  const roomLabel = ROOM_TYPE_LABELS[room.type] || room.type;

  if (empty && lights) {
    recs.push({
      type: 'EMPTY_ROOM_APPLIANCES',
      message: `Turn OFF the lights in ${room.roomNumber} because no occupants are detected.`,
      reason: `Presence sensor reported the room empty while lights remain ON (${room.numLights} lights).`,
      priority: 'high'
    });
  }
  if (empty && fans) {
    recs.push({
      type: 'EMPTY_ROOM_APPLIANCES',
      message: `Turn OFF the fans in ${room.roomNumber} because the room is currently unoccupied.`,
      reason: `Presence sensor reported the room empty while fans remain ON (${room.numFans} fans).`,
      priority: 'high'
    });
  }

  const isLab = ['computer_lab', 'physics_lab', 'chemistry_lab', 'electronics_lab'].includes(room.type);
  const occRatio = occupancy / capacity;

  if (!empty && occRatio < 0.35 && pct > warningPct) {
    recs.push({
      type: 'LOW_OCCUPANCY_HIGH_ENERGY',
      message: `Inspect unnecessary lights, fans or electrical equipment in ${room.roomNumber}. Energy is high compared with current occupancy.`,
      reason: `${roomLabel} has ${occupancy} occupants (${Math.round(occRatio * 100)}% of capacity) but energy is ${Math.round(pct)}% above the expected level.`,
      priority: occRatio < 0.2 ? 'high' : 'medium'
    });
  }

  if (pct > abnormalPct && !(isLab && pct < abnormalPct + 20)) {
    recs.push({
      type: 'EXCESS_ENERGY',
      message: `Energy in ${room.roomNumber} is significantly higher than expected (${Math.round(pct)}%). Inspect appliances and contact the responsible faculty.`,
      reason: `Actual ${room.currentEnergy.toFixed(2)} kWh vs predicted ${room.predictedEnergy.toFixed(2)} kWh for a ${roomLabel.toLowerCase()} with ${occupancy} occupants.`,
      priority: pct > 60 ? 'high' : 'medium'
    });
  }

  // Labs: acknowledge when high consumption is natural for the equipment load.
  if (isLab && room.type === 'computer_lab' && pct < warningPct && occupancy > 0) {
    recs.push({
      type: 'INFO',
      message: `${room.roomNumber} consumption is consistent with computer-lab equipment load.`,
      reason: 'No anomaly detected; lab baseline consumption is naturally higher than a classroom.',
      priority: 'low'
    });
  }

  return recs;
}

/** Persist new recommendations (deduped) and auto-resolve stale ones. */
export async function applyRecommendations(rooms, settings) {
  const allRooms = Array.isArray(rooms) ? rooms : [rooms];
  const applied = [];

  for (const room of allRooms) {
    const recs = buildRecommendationForRoom(room, settings);
    if (room.status === 'normal' && room.currentOccupancy > 0 && room.lightStatus === 'on' && room.fanStatus === 'on') {
      await Recommendation.updateMany(
        { roomId: room._id, status: 'active', type: 'EMPTY_ROOM_APPLIANCES' },
        { $set: { status: 'resolved', resolvedAt: new Date() } }
      );
    }
    if (room.percentageDifference <= (settings?.anomaly?.warningPct ?? 10)) {
      await Recommendation.updateMany(
        { roomId: room._id, status: 'active', type: 'EXCESS_ENERGY' },
        { $set: { status: 'resolved', resolvedAt: new Date() } }
      );
    }
    for (const rec of recs) {
      const existing = await Recommendation.findOne({
        roomId: room._id,
        type: rec.type,
        status: 'active'
      });
      if (!existing) {
        await Recommendation.create({ roomId: room._id, ...rec });
        applied.push({ roomId: room._id, type: rec.type });
      }
    }
  }
  return applied;
}

export async function getRecommendations(filter = {}, limit = 100) {
  return Recommendation.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('roomId', 'roomNumber name buildingId status currentOccupancy');
}

export async function resolveRecommendationForRoom(roomId, type) {
  return Recommendation.updateMany(
    { roomId, type, status: 'active' },
    { $set: { status: 'resolved', resolvedAt: new Date() } }
  );
}

export async function unresolvedAlertForRoom(roomId, type) {
  return Alert.findOne({ roomId, type, status: { $in: ['active', 'contacted'] } });
}

export default {
  buildRecommendationForRoom,
  applyRecommendations,
  getRecommendations,
  resolveRecommendationForRoom
};