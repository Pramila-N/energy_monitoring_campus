import mlService from './mlService.js';
import OccupancyReading from '../models/OccupancyReading.js';
import Classroom from '../models/Classroom.js';
import ApiError from '../utils/ApiError.js';
import { facultyAttendanceFactor } from '../mock-data/occupancy.js';

export function buildOccupancyFeatures({ room, dayOfWeek, period, expectedOccupancy }) {
  return {
    room_id: room.roomNumber,
    building: room.buildingCode || '',
    room_type: room.type,
    day_of_week: Number(dayOfWeek),
    period: Number(period),
    expected_occupancy: Number(expectedOccupancy || 0),
    capacity: Number(room.capacity || 0),
    faculty_avg_attendance: facultyAttendanceFactor(room.roomNumber)
  };
}

/**
 * Predict present occupancy for a batch of rooms using the occupancy model.
 * Falls back to the expected occupancy (clearly logged) only when the model
 * file is missing, so the app stays runnable before training.
 */
export async function predictOccupancyBatch(featureRecords) {
  const fallback = featureRecords.map((f) => ({
    room_id: f.room_id,
    predicted_present: Math.round(f.expected_occupancy * 0.85),
    attendance_probability: 0.85
  }));

  if (!mlService.isOccupancyModelReady()) {
    console.warn('[occupancy] model missing — using fallback; train with `python ml/scripts/train_occupancy_model.py`');
    return fallback;
  }

  const result = await mlService.predictOccupancyBatch(featureRecords);
  return result.predictions ?? result;
}

export async function recordOccupancy(roomId, expected, actual, probability, source = 'dummy_attendance') {
  return OccupancyReading.create({
    roomId,
    timestamp: new Date(),
    expectedOccupancy: expected,
    actualOccupancy: actual,
    attendanceProbability: probability,
    source
  });
}

export async function latestOccupancyForRoom(roomId) {
  return OccupancyReading.findOne({ roomId }).sort({ timestamp: -1 });
}

export default {
  buildOccupancyFeatures,
  predictOccupancyBatch,
  recordOccupancy,
  latestOccupancyForRoom
};