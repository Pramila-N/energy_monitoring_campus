import asyncHandler from '../utils/asyncHandler.js';
import { getSettings, updateSettings } from '../services/settingsService.js';
import mlService from '../services/mlService.js';
import { getSimStatus } from '../services/simulationService.js';

export const getConfig = asyncHandler(async (req, res) => {
  res.json({ settings: await getSettings(), models: mlService.modelStatus(), simulation: getSimStatus() });
});

export const putConfig = asyncHandler(async (req, res) => {
  const settings = await updateSettings(req.body || {});
  res.json({ settings, message: 'Settings updated.' });
});

export default { getConfig, putConfig };