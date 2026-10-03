import mongoose from 'mongoose';

export const ALERT_TYPES = ['EXCESS_ENERGY', 'EMPTY_ROOM_APPLIANCES', 'HIGH_CONSUMPTION', 'SYSTEM_WARNING'];
export const ALERT_SEVERITY = ['low', 'medium', 'high', 'critical'];
export const ALERT_STATUS = ['active', 'contacted', 'resolved'];

const alertSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
    type: { type: String, enum: ALERT_TYPES, required: true },
    severity: { type: String, enum: ALERT_SEVERITY, default: 'medium' },
    message: { type: String, default: '' },
    actualEnergy: { type: Number, default: 0 },
    predictedEnergy: { type: Number, default: 0 },
    percentageDifference: { type: Number, default: 0 },
    occupancy: { type: Number, default: 0 },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', default: null },
    facultyName: { type: String, default: '' },
    status: { type: String, enum: ALERT_STATUS, default: 'active' },
    contactAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: '' }
  },
  { timestamps: true }
);

alertSchema.index({ status: 1, createdAt: -1 });
alertSchema.index({ roomId: 1 });

export default mongoose.model('Alert', alertSchema);