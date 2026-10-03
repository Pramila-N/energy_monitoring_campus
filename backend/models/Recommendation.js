import mongoose from 'mongoose';

export const RECOMMENDATION_STATUS = ['active', 'resolved'];

const recommendationSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    reason: { type: String, default: '' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: RECOMMENDATION_STATUS, default: 'active' },
    resolvedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

recommendationSchema.index({ status: 1, createdAt: -1 });
recommendationSchema.index({ roomId: 1 });

export default mongoose.model('Recommendation', recommendationSchema);