import mongoose from 'mongoose';

export const PREDICTION_STATUS = ['normal', 'warning', 'abnormal'];

const predictionSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    timestamp: { type: Date, required: true, index: true },
    period: { type: Number, default: 0 },
    predictedEnergy: { type: Number, required: true },
    actualEnergy: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
    percentageDifference: { type: Number, default: 0 },
    modelVersion: { type: String, default: 'energy-v1' },
    confidence: { type: Number, default: 0 },
    occupancy: { type: Number, default: 0 },
    status: { type: String, enum: PREDICTION_STATUS, default: 'normal' },
    features: { type: Object, default: {} }
  },
  { timestamps: true }
);

predictionSchema.index({ roomId: 1, timestamp: -1 });

export default mongoose.model('Prediction', predictionSchema);