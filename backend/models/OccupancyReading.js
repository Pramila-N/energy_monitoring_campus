import mongoose from 'mongoose';

const occupancyReadingSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    timestamp: { type: Date, required: true },
    expectedOccupancy: { type: Number, default: 0 },
    actualOccupancy: { type: Number, default: 0 },
    attendanceProbability: { type: Number, default: 0 },
    source: { type: String, default: 'dummy_attendance' }
  },
  { timestamps: true }
);

occupancyReadingSchema.index({ roomId: 1, timestamp: -1 });

export default mongoose.model('OccupancyReading', occupancyReadingSchema);