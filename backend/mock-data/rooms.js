/**
 * DUMMY DATA LAYER — Classrooms & Laboratories
 * Replace with real room-registry / ERP data later.
 */
export const ROOMS = [
  // ---- Academic Block A (classrooms) ----
  { roomNumber: 'A-101', buildingCode: 'A', floor: 1, type: 'classroom', name: 'Lecture Hall 101', capacity: 50, numLights: 10, numFans: 6, hasAC: false, faculty: 'Dr. Meera Nair' },
  { roomNumber: 'A-102', buildingCode: 'A', floor: 1, type: 'classroom', name: 'Lecture Hall 102', capacity: 50, numLights: 10, numFans: 6, hasAC: false, faculty: 'Prof. Suresh Iyer' },
  { roomNumber: 'A-103', buildingCode: 'A', floor: 1, type: 'classroom', name: 'Lecture Hall 103', capacity: 45, numLights: 9, numFans: 5, hasAC: false, faculty: 'Dr. Kavitha Rao' },
  { roomNumber: 'A-201', buildingCode: 'A', floor: 2, type: 'seminar_hall', name: 'Seminar Hall A', capacity: 80, numLights: 16, numFans: 10, hasAC: true, faculty: 'Prof. Ramesh Reddy' },
  { roomNumber: 'A-202', buildingCode: 'A', floor: 2, type: 'classroom', name: 'Lecture Hall 202', capacity: 40, numLights: 8, numFans: 5, hasAC: false, faculty: 'Dr. Anitha Menon' },
  { roomNumber: 'A-203', buildingCode: 'A', floor: 2, type: 'classroom', name: 'Lecture Hall 203', capacity: 40, numLights: 8, numFans: 5, hasAC: false, faculty: 'Prof. Ganesh Kumar' },
  { roomNumber: 'A-301', buildingCode: 'A', floor: 3, type: 'classroom', name: 'Lecture Hall 301', capacity: 35, numLights: 7, numFans: 4, hasAC: false, faculty: 'Dr. Lakshmi Devi' },
  { roomNumber: 'A-302', buildingCode: 'A', floor: 3, type: 'classroom', name: 'Lecture Hall 302', capacity: 35, numLights: 7, numFans: 4, hasAC: false, faculty: 'Prof. Venkat Raman' },

  // ---- Academic Block B (seminar + classrooms) ----
  { roomNumber: 'B-101', buildingCode: 'B', floor: 1, type: 'seminar_hall', name: 'Seminar Hall B', capacity: 90, numLights: 16, numFans: 10, hasAC: true, faculty: 'Dr. Priya Sharma' },
  { roomNumber: 'B-102', buildingCode: 'B', floor: 1, type: 'classroom', name: 'Lecture Hall 102B', capacity: 60, numLights: 12, numFans: 7, hasAC: false, faculty: 'Prof. Arvind Gupta' },
  { roomNumber: 'B-201', buildingCode: 'B', floor: 2, type: 'classroom', name: 'Lecture Hall 201B', capacity: 45, numLights: 9, numFans: 5, hasAC: false, faculty: 'Dr. Sunita Joshi' },
  { roomNumber: 'B-202', buildingCode: 'B', floor: 2, type: 'classroom', name: 'Lecture Hall 202B', capacity: 45, numLights: 9, numFans: 5, hasAC: false, faculty: 'Prof. Mohan Krishnan' },
  { roomNumber: 'B-301', buildingCode: 'B', floor: 3, type: 'staff_room', name: 'Staff Room B', capacity: 20, numLights: 6, numFans: 4, hasAC: true, faculty: 'HOD Office' },

  // ---- Computer Science Block (labs + classrooms) ----
  { roomNumber: 'C-101', buildingCode: 'C', floor: 1, type: 'computer_lab', name: 'Programming Lab 1', capacity: 50, numLights: 12, numFans: 6, hasAC: false, faculty: 'Dr. Arun Kumar' },
  { roomNumber: 'C-102', buildingCode: 'C', floor: 1, type: 'computer_lab', name: 'Programming Lab 2', capacity: 45, numLights: 12, numFans: 6, hasAC: false, faculty: 'Prof. Deepak Singh' },
  { roomNumber: 'C-103', buildingCode: 'C', floor: 1, type: 'classroom', name: 'Theory Classroom 103C', capacity: 40, numLights: 8, numFans: 5, hasAC: false, faculty: 'Dr. Nisha Verma' },
  { roomNumber: 'C-201', buildingCode: 'C', floor: 2, type: 'computer_lab', name: 'Networking Lab', capacity: 40, numLights: 14, numFans: 6, hasAC: true, faculty: 'Prof. Ravi Shankar' },
  { roomNumber: 'C-202', buildingCode: 'C', floor: 2, type: 'computer_lab', name: 'DBMS Lab', capacity: 40, numLights: 12, numFans: 6, hasAC: false, faculty: 'Dr. Kavitha Rao' },
  { roomNumber: 'C-203', buildingCode: 'C', floor: 2, type: 'classroom', name: 'Theory Classroom 203C', capacity: 40, numLights: 8, numFans: 5, hasAC: false, faculty: 'Dr. Arun Kumar' },
  { roomNumber: 'C-204', buildingCode: 'C', floor: 2, type: 'computer_lab', name: 'AI & ML Lab', capacity: 40, numLights: 14, numFans: 6, hasAC: true, faculty: 'Dr. Arun Kumar' },
  { roomNumber: 'C-301', buildingCode: 'C', floor: 3, type: 'computer_lab', name: 'Hardware Lab', capacity: 35, numLights: 12, numFans: 6, hasAC: true, faculty: 'Prof. Deepak Singh' },
  { roomNumber: 'C-302', buildingCode: 'C', floor: 3, type: 'classroom', name: 'Theory Classroom 302C', capacity: 40, numLights: 8, numFans: 5, hasAC: false, faculty: 'Prof. Mohan Krishnan' },
  { roomNumber: 'C-303', buildingCode: 'C', floor: 3, type: 'computer_lab', name: 'Project Lab', capacity: 30, numLights: 10, numFans: 4, hasAC: false, faculty: 'Dr. Nisha Verma' },
  { roomNumber: 'C-304', buildingCode: 'C', floor: 3, type: 'classroom', name: 'Theory Classroom 304C', capacity: 45, numLights: 9, numFans: 5, hasAC: false, faculty: 'Prof. Ganesh Kumar' },
  { roomNumber: 'C-305', buildingCode: 'C', floor: 3, type: 'classroom', name: 'Theory Classroom 305C', capacity: 45, numLights: 9, numFans: 5, hasAC: false, faculty: 'Dr. Priya Sharma' },

  // ---- Laboratory Block ----
  { roomNumber: 'L-101', buildingCode: 'L', floor: 1, type: 'physics_lab', name: 'Physics Lab 1', capacity: 35, numLights: 10, numFans: 5, hasAC: false, faculty: 'Prof. Ramesh Reddy' },
  { roomNumber: 'L-102', buildingCode: 'L', floor: 1, type: 'physics_lab', name: 'Physics Lab 2', capacity: 35, numLights: 10, numFans: 5, hasAC: false, faculty: 'Dr. Sunita Joshi' },
  { roomNumber: 'L-103', buildingCode: 'L', floor: 1, type: 'chemistry_lab', name: 'Chemistry Lab 1', capacity: 35, numLights: 12, numFans: 8, hasAC: false, faculty: 'Dr. Lakshmi Devi' },
  { roomNumber: 'L-201', buildingCode: 'L', floor: 2, type: 'electronics_lab', name: 'Electronics Lab', capacity: 30, numLights: 12, numFans: 6, hasAC: true, faculty: 'Prof. Venkat Raman' },
  { roomNumber: 'L-202', buildingCode: 'L', floor: 2, type: 'chemistry_lab', name: 'Chemistry Lab 2', capacity: 30, numLights: 12, numFans: 6, hasAC: false, faculty: 'Dr. Anitha Menon' }
];

export default ROOMS;