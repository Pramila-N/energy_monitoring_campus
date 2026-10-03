import EnergyReading from '../models/EnergyReading.js';
import Alert from '../models/Alert.js';

/**
 * Energy savings = energy that was NOT consumed because lights/fans were
 * automatically switched OFF during the simulated interval.
 *
 *   saving = (numLights - lightsOn) * LIGHT_DRAW + (numFans - fansOn) * FAN_DRAW
 * scaled by the interval duration.
 */
export async function energySavedSince(start) {
  const readings = await EnergyReading.find({
    timestamp: { $gte: start }
  }).lean();
  let saved = 0;
  for (const r of readings) {
    const potential = r.potentialApplianceEnergy || 0;
    const actual = r.applianceEnergy || 0;
    saved += Math.max(0, potential - actual);
  }
  return Number(saved.toFixed(3));
}

export async function totalEnergySince(start) {
  const agg = await EnergyReading.aggregate([
    { $match: { timestamp: { $gte: start } } },
    { $group: { _id: null, total: { $sum: '$energyConsumption' }, count: { $sum: 1 } } }
  ]);
  const row = agg[0] || { total: 0, count: 0 };
  return { total: Number(row.total.toFixed(3)), count: row.count };
}

export async function energyByBuildingSince(start) {
  const agg = await EnergyReading.aggregate([
    { $match: { timestamp: { $gte: start } } },
    {
      $group: {
        _id: '$buildingId',
        energy: { $sum: '$energyConsumption' },
        count: { $sum: 1 }
      }
    },
    { $sort: { energy: -1 } }
  ]);
  return agg;
}

export async function energyByRoomSince(start) {
  const agg = await EnergyReading.aggregate([
    { $match: { timestamp: { $gte: start } } },
    {
      $group: {
        _id: '$roomId',
        energy: { $sum: '$energyConsumption' },
        count: { $sum: 1 }
      }
    },
    { $sort: { energy: -1 } }
  ]);
  return agg;
}

export async function energySeries(roomId, hours) {
  const from = new Date(Date.now() - hours * 3600 * 1000);
  const readings = await EnergyReading.find({ roomId, timestamp: { $gte: from } })
    .sort({ timestamp: 1 })
    .lean();
  return readings.map((r) => ({
    x: r.timestamp,
    energy: r.energyConsumption,
    hourlyRate: r.hourlyRate,
    power: r.power,
    occupancy: r.occupancy,
    lightsOn: r.lightsOn,
    fansOn: r.fansOn,
    anomalous: r.anomalous
  }));
}

export async function alertsResolvedSince(start) {
  return Alert.countDocuments({ status: 'resolved', resolvedAt: { $gte: start } });
}

export default {
  energySavedSince,
  totalEnergySince,
  energyByBuildingSince,
  energyByRoomSince,
  energySeries,
  alertsResolvedSince
};