import asyncHandler from '../utils/asyncHandler.js';
import alertService from '../services/alertService.js';
import recommendationService from '../services/recommendationService.js';

export const getAlerts = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.severity) filter.severity = req.query.severity;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.roomId) filter.roomId = req.query.roomId;
  const limit = Math.min(Number(req.query.limit || 200), 500);
  const alerts = await alertService.listAlerts(filter, limit);
  res.json({ alerts });
});

export const patchAlert = asyncHandler(async (req, res) => {
  const { status, resolutionNote } = req.body || {};
  let alert;
  if (status === 'resolved') {
    alert = await alertService.resolveAlert(req.params.id, resolutionNote);
  } else if (status === 'active') {
    alert = await alertService.contactAlert(req.params.id);
  } else {
    return res.status(400).json({ message: 'Unsupported status update.' });
  }
  if (!alert) return res.status(404).json({ message: 'Alert not found.' });
  res.json({ alert });
});

export const contactAlert = asyncHandler(async (req, res) => {
  const alert = await alertService.contactAlert(req.params.id);
  if (!alert) return res.status(404).json({ message: 'Alert not found.' });
  res.json({ message: 'Faculty contacted successfully.', alert });
});

export const resolveAlert = asyncHandler(async (req, res) => {
  const alert = await alertService.resolveAlert(req.params.id, req.body?.resolutionNote || '');
  if (!alert) return res.status(404).json({ message: 'Alert not found.' });
  res.json({ message: 'Alert resolved.', alert });
});

export default { getAlerts, patchAlert, contactAlert, resolveAlert };