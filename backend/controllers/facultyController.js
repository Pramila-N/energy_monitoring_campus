import asyncHandler from '../utils/asyncHandler.js';
import Faculty from '../models/Faculty.js';
import Classroom from '../models/Classroom.js';

export const listFaculty = asyncHandler(async (req, res) => {
  const faculty = await Faculty.find({}).sort({ name: 1 }).lean();
  const withRooms = await Promise.all(
    faculty.map(async (f) => {
      const rooms = await Classroom.find({ facultyId: f._id })
        .select('roomNumber name currentEnergy status currentOccupancy')
        .lean();
      return { ...f, rooms };
    })
  );
  res.json({ faculty: withRooms });
});

export const getFaculty = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findById(req.params.id).lean();
  if (!faculty) {
    return res.status(404).json({ message: 'Faculty not found.' });
  }
  const rooms = await Classroom.find({ facultyId: faculty._id }).lean();
  res.json({ faculty, rooms });
});

export const contactFaculty = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findById(req.params.id).lean();
  if (!faculty) {
    return res.status(404).json({ message: 'Faculty not found.' });
  }
  res.json({
    message: `Simulated call/SMS to ${faculty.name} at ${faculty.phoneNumber || 'registered number'} — asked to check appliances in assigned room.`,
    faculty: { name: faculty.name, department: faculty.department, phoneNumber: faculty.phoneNumber }
  });
});

export default { listFaculty, getFaculty, contactFaculty };