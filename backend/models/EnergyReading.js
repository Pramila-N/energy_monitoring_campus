import mongoose from 'mongoose';

const energyReadingSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
    timestamp: { type: Date, required: true, index: true },
    energyConsumption: { type: Number, required: true },
    power: { type: Number, default: 0 },
    hourlyRate: { type: Number, default: 0 },
    voltage: { type: Number, default: 230 },
    current: { type: Number, default: 0 },
    intervalMinutes: { type: Number, default: 30 },
    occupancy: { type: Number, default: 0 },
    lightsOn: { type: Number, default: 0 },
    fansOn: { type: Number, default: 0 },
    applianceEnergy: { type: Number, default: 0 },
    potentialApplianceEnergy: { type: Number, default: 0 },
    anomalous: { type: Boolean, default: false },
    source: { type: String, default: 'dummy_meter' }
  },
  { timestamps: true }
);

energyReadingSchema.index({ roomId: 1, timestamp: -1 });
energyReadingSchema.index({ buildingId: 1, timestamp: -1 });

export default mongoose.model('EnergyReading', energyReadingSchema);