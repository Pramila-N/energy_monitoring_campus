import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import connectDB from '../config/database.js';
import Admin from '../models/Admin.js';
import Building from '../models/Building.js';
import Classroom from '../models/Classroom.js';
import Faculty from '../models/Faculty.js';
import EnergyReading from '../models/EnergyReading.js';
import OccupancyReading from '../models/OccupancyReading.js';
import Prediction from '../models/Prediction.js';
import Alert from '../models/Alert.js';
import Recommendation from '../models/Recommendation.js';
import BUILDINGS from '../mock-data/buildings.js';
import ROOMS from '../mock-data/rooms.js';
import FACULTY from '../mock-data/faculty.js';
import { exportPredictionInput } from '../mock-data/timetable.js';
import { generateBulkHistory } from '../services/bulkHistoryService.js';
import mlService from '../services/mlService.js';

const SEED_HISTORY_DAYS = process.env.SEED_HISTORY_DAYS ? Number(process.env.SEED_HISTORY_DAYS) : 40;
const SEED_PREDICTION_DAYS = process.env.SEED_PREDICTION_DAYS ? Number(process.env.SEED_PREDICTION_DAYS) : 20;

async function seedAdmin() {
  const existing = await Admin.findOne({ email: 'admin@smartcampus.local' });
  if (existing) {
    console.log('Admin already exists (admin@smartcampus.local / Admin@123)');
    return;
  }
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  await Admin.create({
    name: 'Campus Administrator',
    email: 'admin@smartcampus.local',
    passwordHash,
    role: 'admin'
  });
  console.log('Admin created -> admin@smartcampus.local / Admin@123');
}

async function seedBuildings() {
  const bulk = BUILDINGS.map((b) => ({
    updateOne: {
      filter: { code: b.code },
      update: { $setOnInsert: { ...b } },
      upsert: true
    }
  }));
  await Building.bulkWrite(bulk);
  console.log(`Buildings seeded (${BUILDINGS.length})`);
  return Building.find({}).lean();
}

async function seedFaculty() {
  const bulk = FACULTY.map((f) => ({
    updateOne: {
      filter: { employeeId: f.employeeId },
      update: {
        $set: {
          name: f.name,
          department: f.department,
          phoneNumber: f.phoneNumber,
          email: f.email,
          assignedRooms: f.rooms
        }
      },
      upsert: true
    }
  }));
  await Faculty.bulkWrite(bulk);
  console.log(`Faculty seeded (${FACULTY.length})`);
  return Faculty.find({}).lean();
}

async function seedRooms(buildings, facultyList) {
  const buildingCodeMap = {};
  buildings.forEach((b) => {
    buildingCodeMap[b.code] = b._id;
  });
  const facultyNameMap = {};
  const facultyRoomMap = {};
  facultyList.forEach((f) => {
    facultyNameMap[f.name] = f._id;
    f.assignedRooms.forEach((r) => {
      facultyRoomMap[r] = { id: f._id, name: f.name };
    });
  });

  const bulk = ROOMS.map((r) => {
    const fac = facultyRoomMap[r.roomNumber] || {};
    return {
      updateOne: {
        filter: { roomNumber: r.roomNumber },
        update: {
          $set: {
            name: r.name,
            buildingId: buildingCodeMap[r.buildingCode],
            floor: r.floor,
            type: r.type,
            capacity: r.capacity,
            numLights: r.numLights,
            numFans: r.numFans,
            hasAC: r.hasAC,
            assignedFaculty: fac.name || r.faculty || '',
            facultyId: fac.id || null
          },
          $setOnInsert: {
            currentOccupancy: 0,
            lightStatus: 'off',
            fanStatus: 'off',
            presenceDetected: false,
            status: 'normal'
          }
        },
        upsert: true
      }
    };
  });
  await Classroom.bulkWrite(bulk);
  console.log(`Rooms seeded (${ROOMS.length})`);
  return Classroom.find({}).lean();
}

async function clearHistory() {
  await Promise.all([
    EnergyReading.deleteMany({}),
    OccupancyReading.deleteMany({}),
    Prediction.deleteMany({}),
    Alert.deleteMany({}),
    Recommendation.deleteMany({})
  ]);
}

async function main() {
  const reset = process.argv.includes('--reset');
  await connectDB(env.mongoUri);

  if (reset) {
    console.log('Resetting database...');
    await Promise.all([
      Admin.deleteMany({}),
      Building.deleteMany({}),
      Classroom.deleteMany({}),
      Faculty.deleteMany({})
    ]);
    await clearHistory();
  }

  await seedAdmin();
  const buildings = await seedBuildings();
  const facultyList = await seedFaculty();
  await seedRooms(buildings, facultyList);
  await clearHistory();

  const files = exportPredictionInput(env.mlDir);
  console.log('Attendance plan exported ->', files);

  const ready = mlService.isEnergyModelReady();
  console.log(`Energy model ready: ${ready ? 'YES' : 'NO (no prediction history will be generated; run "python ml/scripts/train_model.py" first)'}`);

  console.log(`Generating ${SEED_HISTORY_DAYS} weekdays of meter/sensor history (real ML predictions for last ${SEED_PREDICTION_DAYS} days)...`);
  const historyStats = await generateBulkHistory({
    days: SEED_HISTORY_DAYS,
    predictionDays: SEED_PREDICTION_DAYS
  });

  const stats = {
    readings: historyStats.readings,
    occupancy: historyStats.occupancy,
    predictions: historyStats.predictions,
    alerts: historyStats.alerts,
    recommendations: historyStats.recommendations
  };
  console.log('Seed complete:', JSON.stringify(stats));
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('Seed failed:', e);
  await mongoose.disconnect();
  process.exit(1);
});