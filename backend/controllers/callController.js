import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Classroom from '../models/Classroom.js';
import CallLog from '../models/CallLog.js';
import voiceService from '../services/voiceService.js';
import env from '../config/env.js';

/** Only ever send masked numbers to the frontend. */
function sanitizeCall(call) {
  if (!call) return null;
  return {
    _id: call._id,
    classroomId: call.classroomId?._id || call.classroomId,
    roomNumber: call.roomNumber || call.classroomId?.roomNumber || '',
    facultyId: call.facultyId,
    facultyName: call.facultyName,
    provider: call.provider,
    providerCallId: call.providerCallId,
    status: call.status,
    duration: call.duration || 0,
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    failureReason: call.failureReason || '',
    maskedPhone: voiceService.maskPhoneNumber(call.phoneNumber),
    createdAt: call.createdAt
  };
}

/**
 * POST /api/calls/faculty  { classroomId }
 * Authenticated admin only. Never accepts an arbitrary phone number — the number
 * always comes from the classroom's assigned faculty record.
 */
export const createCall = asyncHandler(async (req, res) => {
  const { classroomId } = req.body || {};

  if (!classroomId || !mongoose.isValidObjectId(classroomId)) {
    throw new ApiError(400, 'A valid classroomId is required.');
  }

  const classroom = await Classroom.findById(classroomId).populate('facultyId');
  if (!classroom) throw new ApiError(404, 'Classroom not found.');

  const faculty = classroom.facultyId;
  if (!faculty) throw new ApiError(400, `No faculty is assigned to ${classroom.roomNumber}.`);
  if (faculty.active === false) throw new ApiError(400, `${faculty.name} is inactive and cannot be called.`);

  const active = await CallLog.findOne({
    $or: [{ classroomId: classroom._id }, { facultyId: faculty._id }],
    status: { $in: voiceService.ACTIVE_STATUSES },
    createdAt: { $gte: new Date(Date.now() - 10 * 60000) }
  }).lean();

  if (active) {
    throw new ApiError(409, `A call is already in progress for ${classroom.roomNumber} (${faculty.name}). Please wait for it to finish.`);
  }

  let call;
  try {
    call = await voiceService.initiateCall({ classroom, faculty, adminId: req.admin?._id });
  } catch (err) {
    throw new ApiError(502, err.message);
  }

  res.status(201).json({
    success: true,
    message: 'Call initiated successfully',
    callId: call.providerCallId,
    facultyName: faculty.name,
    status: call.status,
    roomNumber: classroom.roomNumber,
    mode: call.provider
  });
});

/** GET /api/calls/status/:classroomId — latest call + whether one is live. */
export const getStatusForRoom = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  if (!mongoose.isValidObjectId(classroomId)) throw new ApiError(400, 'Invalid classroomId.');

  const lastCall = await CallLog.findOne({ classroomId }).sort({ createdAt: -1 }).lean();
  res.json({
    classroomId,
    active: Boolean(lastCall && voiceService.ACTIVE_STATUSES.includes(lastCall.status)),
    lastCall: sanitizeCall(lastCall)
  });
});

/** GET /api/calls/history — recent calls (admin). */
export const getHistory = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 100);
  const calls = await CallLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ calls: calls.map(sanitizeCall) });
});

/**
 * POST /api/calls/webhook — public endpoint called by Exotel on every call status
 * change (ringing, in-progress, completed, no-answer, busy, failed…). The provider
 * (not the browser) is the source of truth for answered/not-answered.
 */
export const handleWebhook = asyncHandler(async (req, res) => {
  if (env.callWebhookUser || env.callWebhookPass) {
    const header = req.headers.authorization || '';
    const expected = `Basic ${Buffer.from(`${env.callWebhookUser}:${env.callWebhookPass}`).toString('base64')}`;
    if (header !== expected) throw new ApiError(401, 'Unauthorized webhook.');
  }

  const body = req.body || {};
  const providerCallId = body.CallSid || body.Sid || body.callSid || body.sid || '';
  const status = voiceService.mapExotelStatus(body.CallStatus || body.Status || body.callStatus || body.status) ||
    // Exotel also reports dial status in the `DialCallStatus` field for trans calls.
    voiceService.mapExotelStatus(body.DialCallStatus || body.dialCallStatus);
  const duration = Number(body.CallDuration || body.Duration || 0) || 0;
  const failureReason = String(body.FailureReason || body.failureReason || body.message || '');

  if (!providerCallId) {
    console.warn('[calls] webhook received without a call id:', JSON.stringify(body).slice(0, 300));
    return res.json({ status: 'ignored' });
  }
  if (!status) {
    console.warn('[calls] webhook unknown status:', body.CallStatus || body.Status, 'for', providerCallId);
    return res.json({ status: 'ok' });
  }

  const patch = { status };
  if (['answered', 'in-progress'].includes(status)) {
    patch.startedAt = new Date();
  }
  if (voiceService.isTerminalStatus(status)) {
    patch.endedAt = new Date();
    patch.duration = duration;
    if (status === 'failed' && failureReason) patch.failureReason = failureReason;
  }

  const updated = await CallLog.findOneAndUpdate({ providerCallId }, patch, { new: true }).lean();
  if (!updated) console.warn('[calls] webhook for unknown call', providerCallId);
  res.json({ status: 'ok' });
});

/** GET /api/calls/:callId/ivr — public. Exotel fetches this when the faculty answers. */
export const serveIVR = asyncHandler(async (req, res) => {
  const call = await CallLog.findById(req.params.callId).populate('classroomId').lean();
  const room = call?.classroomId || {};
  res.setHeader('Content-Type', 'text/xml');
  res.send(
    voiceService.buildIvRXml({
      roomNumber: call?.roomNumber || room.roomNumber || 'the room',
      facultyName: call?.facultyName || '',
      actualRate: room.currentEnergy || 0,
      predicted: room.predictedEnergy || 0,
      pct: room.percentageDifference || 0
    })
  );
});

export default { createCall, getStatusForRoom, getHistory, handleWebhook, serveIVR };