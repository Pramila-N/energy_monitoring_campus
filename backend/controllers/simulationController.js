import asyncHandler from '../utils/asyncHandler.js';
import { runTick, getSimStatus, startSimulation, stopSimulation, setSimulationSpeed } from '../services/simulationService.js';

export const manualUpdate = asyncHandler(async (req, res) => {
  await runTick();
  res.json({ message: 'Simulation tick completed.', status: getSimStatus() });
});

export const getStatus = asyncHandler(async (req, res) => {
  res.json({ status: getSimStatus() });
});

export const start = asyncHandler(async (req, res) => {
  res.json({ status: startSimulation(req.body?.intervalMs) });
});

export const stop = asyncHandler(async (req, res) => {
  res.json({ status: stopSimulation() });
});

export const setSpeed = asyncHandler(async (req, res) => {
  res.json({ status: setSimulationSpeed(req.body?.intervalMs) });
});

export default { manualUpdate, getStatus, start, stop, setSpeed };