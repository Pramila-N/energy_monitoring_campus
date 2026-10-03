import mongoose from 'mongoose';

export const ROOM_TYPES = ['classroom', 'computer_lab', 'physics_lab', 'chemistry_lab', 'electronics_lab', 'seminar_hall', 'staff_room'];
export const ROOM_STATUS = ['normal', 'warning', 'abnormal', 'inactive'];

const classroomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true, unique: true, trim: true },
    name: { type: String, default: '' },
    buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
    floor: { type: Number, default: 1 },
    type: { type: String, enum: ROOM_TYPES, default: 'classroom' },
    capacity: { type: Number, default: 40 },
    numLights: { type: Number, default: 8 },
    numFans: { type: Number, default: 4 },
    hasAC: { type: Boolean, default: false },
    assignedFaculty: { type: String, default: '' },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', default: null },

    currentOccupancy: { type: Number, default: 0 },
    expectedOccupancy: { type: Number, default: 0 },
    lightStatus: { type: String, enum: ['on', 'off'], default: 'off' },
    fanStatus: { type: String, enum: ['on', 'off'], default: 'off' },
    presenceDetected: { type: Boolean, default: false },

    currentEnergy: { type: Number, default: 0 },
    predictedEnergy: { type: Number, default: 0 },
    energyDifference: { type: Number, default: 0 },
    percentageDifference: { type: Number, default: 0 },
    status: { type: String, enum: ROOM_STATUS, default: 'normal' },

    scenario: { type: String, default: '' }
  },
  { timestamps: true }
);

classroomSchema.index({ buildingId: 1 });
classroomSchema.index({ status: 1 });

export default mongoose.model('Classroom', classroomSchema);