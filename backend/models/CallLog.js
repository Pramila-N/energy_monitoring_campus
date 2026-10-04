import mongoose from 'mongoose';

const callLogSchema = new mongoose.Schema(
  {
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
    facultyName: { type: String, required: true },
    roomNumber: { type: String, default: '' },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    phoneNumber: { type: String, default: '' },
    provider: { type: String, default: 'demo' }, // 'exotel' | 'demo'
    providerCallId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['initiated', 'ringing', 'answered', 'in-progress', 'completed', 'busy', 'no-answer', 'failed'],
      default: 'initiated'
    },
    duration: { type: Number, default: 0 }, // seconds
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    failureReason: { type: String, default: '' }
  },
  { timestamps: true }
);

callLogSchema.index({ classroomId: 1, createdAt: -1 });
callLogSchema.index({ providerCallId: 1 });

export default mongoose.model('CallLog', callLogSchema);