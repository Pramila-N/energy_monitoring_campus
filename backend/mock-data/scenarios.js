/**
 * DUMMY INTEGRATION LAYER — Demo scenarios
 *
 * Deterministic situations injected into the dummy meter / sensor stream so
 * the full admin workflow (anomaly -> alert -> recommend -> contact -> resolve)
 * can be demonstrated reliably during a live demo.
 *
 * Replace with real device behaviour later; nothing else in the app changes.
 */
export const SCENARIOS = [
  {
    // Persistent excess-energy consumer (the demo showcase room).
    roomNumber: 'C-204',
    effect: 'high-consumption',
    multiplier: 1.72,
    note: 'Injected abnormal consumption (demo): consumption significantly above prediction while occupancy is normal.'
  },
  {
    // Empty room whose lights stay ON (auto-control demo: EMPTY_ROOM_APPLIANCES).
    roomNumber: 'C-305',
    effect: 'empty-room-appliances',
    when: { periodsStart: 2, periodsEnd: 6 },
    note: 'Injected stuck-light scenario (demo): presence lost but lights left ON.'
  },
  {
    // Low occupancy but unexpected higher consumption (inspect appliances).
    roomNumber: 'A-103',
    effect: 'low-occupancy-high-energy',
    multiplier: 1.45,
    note: 'Injected low-occupancy high-energy scenario (demo).'
  }
];

export function scenarioFor(roomNumber) {
  return SCENARIOS.find((s) => s.roomNumber === roomNumber) || null;
}

export default SCENARIOS;