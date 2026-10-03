import asyncHandler from '../utils/asyncHandler.js';
import Classroom from '../models/Classroom.js';
import recommendationService from '../services/recommendationService.js';
import { getSettings } from '../services/settingsService.js';

export const getRecommendations = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.roomId) filter.roomId = req.query.roomId;
  const limit = Math.min(Number(req.query.limit || 200), 500);
  const recommendations = await recommendationService.getRecommendations(filter, limit);
  res.json({ recommendations });
});

export const resolveRecommendation = asyncHandler(async (req, res) => {
  await recommendationService.resolveRecommendationForRoom(req.params.roomId, req.params.type);
  res.json({ message: 'Recommendation resolved.' });
});

export const generateRecommendations = asyncHandler(async (req, res) => {
  const rooms = await Classroom.find({}).lean();
  const applied = await recommendationService.applyRecommendations(rooms, await getSettings());
  res.json({ message: 'Recommendations evaluated.', applied });
});

export default { getRecommendations, resolveRecommendation, generateRecommendations };