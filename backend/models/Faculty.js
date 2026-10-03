import mongoose from 'mongoose';

const facultySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    employeeId: { type: String, required: true, unique: true },
    department: { type: String, default: 'General' },
    phoneNumber: { type: String, default: '' },
    email: { type: String, default: '' },
    assignedRooms: [{ type: String }]
  },
  { timestamps: true }
);

export default mongoose.model('Faculty', facultySchema);