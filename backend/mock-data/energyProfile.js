/**
 * DUMMY INTEGRATION LAYER — Energy profiles per room type.
 * These constants drive the dummy meter generator so generated energy has a
 * meaningful relationship with room type, occupancy and appliance state.
 */

export const ROOM_TYPE_LABELS = {
  classroom: 'Classroom',
  computer_lab: 'Computer Lab',
  physics_lab: 'Physics Lab',
  chemistry_lab: 'Chemistry Lab',
  electronics_lab: 'Electronics Lab',
  seminar_hall: 'Seminar Hall',
  staff_room: 'Staff Room'
};

export const ENERGY_PROFILES = {
  classroom:      { equipmentDraw: 0.2, occupancyScale: 1.6, idleMultiplier: 0.25 },
  seminar_hall:   { equipmentDraw: 0.8, occupancyScale: 1.8, idleMultiplier: 0.2 },
  computer_lab:   { equipmentDraw: 1.2, occupancyScale: 1.3, idleMultiplier: 0.35 },
  physics_lab:    { equipmentDraw: 1.0, occupancyScale: 1.2, idleMultiplier: 0.4 },
  chemistry_lab:  { equipmentDraw: 1.1, occupancyScale: 1.2, idleMultiplier: 0.45 },
  electronics_lab:{ equipmentDraw: 1.0, occupancyScale: 1.2, idleMultiplier: 0.4 },
  staff_room:     { equipmentDraw: 0.4, occupancyScale: 0.8, idleMultiplier: 0.5 }
};

/** Per-appliance draw in kW (used for savings + mock meter). */
export const LIGHT_DRAW_KW = 0.014;
export const FAN_DRAW_KW = 0.02;

export function applianceEnergy(room, intervalHours) {
  const lights = room.lightStatus === 'on' ? room.numLights : 0;
  const fans = room.fanStatus === 'on' ? room.numFans : 0;
  return {
    lights,
    fans,
    applianceEnergy: (lights * LIGHT_DRAW_KW + fans * FAN_DRAW_KW) * intervalHours,
    potentialApplianceEnergy: (room.numLights * LIGHT_DRAW_KW + room.numFans * FAN_DRAW_KW) * intervalHours
  };
}

export function computeRoomDraw(room, occupancy) {
  const profile = ENERGY_PROFILES[room.type] || ENERGY_PROFILES.classroom;
  const occFactor = Math.min(1, Math.max(0, room.capacity > 0 ? occupancy / room.capacity : 0));
  const lights = room.lightStatus === 'on' ? room.numLights : 0;
  const fans = room.fanStatus === 'on' ? room.numFans : 0;

  if (occupancy <= 0) {
    return profile.equipmentDraw * profile.idleMultiplier + lights * LIGHT_DRAW_KW + fans * FAN_DRAW_KW;
  }
  return (
    profile.equipmentDraw +
    occFactor * profile.occupancyScale +
    lights * LIGHT_DRAW_KW +
    fans * FAN_DRAW_KW
  );
}

export default ENERGY_PROFILES;