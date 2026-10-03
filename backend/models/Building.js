import mongoose from 'mongoose';

const buildingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    floors: { type: Number, default: 1 },
    description: { type: String, default: '' },
    totalRooms: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'maintenance'], default: 'active' }
  },
  { timestamps: true }
);

export default mongoose.model('Building', buildingSchema);