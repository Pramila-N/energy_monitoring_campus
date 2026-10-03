import EnergyReading from '../models/EnergyReading.js';
import Prediction from '../models/Prediction.js';
import Alert from '../models/Alert.js';
import Building from '../models/Building.js';
import Classroom from '../models/Classroom.js';
import energyService from './energyService.js';
import AlertModel from '../models/Alert.js';

function localTimezoneString() {
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}
const LOCAL_TZ = localTimezoneString();

function startOfRange(type, from) {
  const d = type === 'week'
    ? new Date(from.getTime() - 6 * 86400000)
    : type === 'month'
      ? new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
      : new Date(from);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function byPeriod(type, fromDate, toDate) {
  const match = { timestamp: { $gte: fromDate } };
  if (toDate) match.timestamp = { ...match.timestamp, $lte: toDate };

  // Day report = hourly buckets; week/month = daily buckets.
  const gid = type === 'day'
    ? { $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp', timezone: LOCAL_TZ } }
    : { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: LOCAL_TZ } };

  return EnergyReading.aggregate([
    { $match: match },
    { $group: { _id: gid, energy: { $sum: '$energyConsumption' }, count: { $sum: 1 }, savings: { $sum: { $max: [0, { $subtract: ['$potentialApplianceEnergy', '$applianceEnergy'] }] } } } },
    { $sort: { _id: 1 } }
  ]).catch(() => []);
}

export async function buildReport({ type = 'day', from, to } = {}) {
  const now = new Date();
  const fromDate = startOfRange(type, from ? new Date(from) : now);
  const toDate = to ? new Date(to) : new Date(now.getTime() + 86400000);

  const [period, buildings, rooms, predictions, alerts] = await Promise.all([
    byPeriod(type, fromDate, toDate),
    Building.find({}).lean(),
    Classroom.find({}).populate('buildingId', 'name code').lean(),
    Prediction.find({ status: 'abnormal', createdAt: { $gte: fromDate } }).countDocuments(),
    Alert.find({ resolvedAt: { $gte: fromDate, $lte: toDate } }).countDocuments()
  ]);

  const buildingRows = await energyService.energyByBuildingSince(fromDate);
  const buildingMap = new Map(buildings.map((b) => [b._id.toString(), b]));
  const buildingWise = buildingRows.map((r) => ({
    buildingId: r._id,
    name: buildingMap.get(r._id.toString())?.name || 'Unknown',
    code: buildingMap.get(r._id.toString())?.code || '',
    energy: Number(r.energy.toFixed(2))
  }));

  const roomRows = await energyService.energyByRoomSince(fromDate);
  const roomMap = new Map(rooms.map((r) => [r._id.toString(), r]));
  const roomWise = roomRows.map((r) => {
    const room = roomMap.get(r._id.toString());
    return {
      roomId: r._id,
      roomNumber: room ? `${room.buildingId?.code || ''}-${room.roomNumber}` : 'Unknown',
      type: room?.type || '',
      energy: Number(r.energy.toFixed(2))
    };
  });

  const saved = Number((await energyService.energySavedSince(fromDate)).toFixed(2));
  const totals = await energyService.totalEnergySince(fromDate);

  return {
    range: { from: fromDate, to: toDate, type },
    totalEnergy: totals.total,
    readings: totals.count,
    energySaved: saved,
    anomalies: predictions,
    resolvedAlerts: alerts,
    period: period.map((p) => ({ label: p._id, energy: Number(p.energy.toFixed(2)), sav: Number(p.savings.toFixed(2)) })),
    byBuilding: buildingWise,
    byRoom: roomWise
  };
}

export function toCSV(report) {
  const rows = [];
  rows.push(['Report Period', report.range.from.toISOString().slice(0, 10), report.range.to.toISOString().slice(0, 10)]);
  rows.push([]);
  rows.push(['Summary', 'Value']);
  rows.push(['Total Energy (kWh)', report.totalEnergy]);
  rows.push(['Energy Saved (kWh)', report.energySaved]);
  rows.push(['Anomalies Detected', report.anomalies]);
  rows.push(['Resolved Alerts', report.resolvedAlerts]);
  rows.push([]);
  rows.push(['Period', 'Energy (kWh)', 'Saved (kWh)']);
  report.period.forEach((p) => rows.push([p.label, p.energy, p.sav]));
  rows.push([]);
  rows.push(['Building', 'Energy (kWh)']);
  report.byBuilding.forEach((b) => rows.push([b.name, b.energy]));
  rows.push([]);
  rows.push(['Room', 'Type', 'Energy (kWh)']);
  report.byRoom.forEach((r) => rows.push([r.roomNumber, r.type, r.energy]));
  return rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

export default { buildReport, toCSV };