import CallLog from '../models/CallLog.js';
import env from '../config/env.js';

/**
 * Real telephony service.
 *
 * Modes:
 *  - `demo`  (VOICE_PROVIDER=demo, the default): no network call is placed.
 *            A realistic ringing → (answered | no-answer) lifecycle is simulated
 *            and written to the CallLog collection so the UI can be developed,
 *            tested and demoed without a telephony account.
 *  - `exotel` (VOICE_PROVIDER=exotel + EXOTEL_* env variables): initiates a REAL
 *            outbound voice call to the faculty's Indian mobile number.
 *
 * The provider API is never called from the frontend; only the backend holds the
 * credentials (see backend/.env, which is gitignored).
 */

export const ACTIVE_STATUSES = ['initiated', 'ringing', 'answered', 'in-progress'];

/** Strip spaces/hyphens, then map any Indian mobile format to E.164 (+91XXXXXXXXXX). */
export function normalizeIndianMobile(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, '');
  let n = digits.replace(/^\+/, '');
  if (/^91\d{10}$/.test(n)) n = n.slice(2);
  else if (/^0\d{10}$/.test(n)) n = n.slice(1);
  if (!/^\d{10}$/.test(n) || !/^[6-9]/.test(n)) return null; // Indian mobiles start 6-9
  return `+91${n}`;
}

export function isValidIndianMobile(phone) {
  return Boolean(normalizeIndianMobile(phone));
}

/** Never reveal the full number to the UI. */
export function maskPhoneNumber(phone) {
  const e164 = normalizeIndianMobile(phone);
  if (!e164) return phone ? `+91•••• •••• ${String(phone).slice(-2)}` : '';
  return `+91•••• •••• ${e164.slice(-2)}`;
}

/** Status strings Exotel sends in status callbacks → our CallLog enum. */
export function mapExotelStatus(status) {
  const s = String(status || '').toLowerCase();
  if (!s) return null;
  if (['queued', 'initiating', 'created', 'in-queue'].includes(s)) return 'initiated';
  if (s === 'ringing') return 'ringing';
  if (s === 'answered') return 'answered';
  if (['in-progress', 'in progress', 'progress'].includes(s)) return 'in-progress';
  if (['completed', 'finished', 'completed-due-to-hangup'].includes(s)) return 'completed';
  if (s === 'busy' || s === 'line-busy') return 'busy';
  if (['no-answer', 'cancelled', 'canceled', 'no-ans'].includes(s)) return 'no-answer';
  if (['failed', 'error', 'server-error', 'client-error', 'rejected'].includes(s)) return 'failed';
  return null;
}

export function isTerminalStatus(status) {
  return ['completed', 'busy', 'no-answer', 'failed'].includes(status);
}

export function hasActiveCall(calls) {
  return (calls || []).some((c) => ACTIVE_STATUSES.includes(c.status));
}

function reqId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Build the Exotel answer-bridge XML read aloud to the faculty when they pick up. */
export function buildIvRXml({ roomNumber, facultyName, actualRate, predicted, pct }) {
  const greeting = facultyName ? `Calling ${facultyName}. ` : '';
  const text = `${greeting}This is the campus energy monitoring system. AI detected that electricity consumption in room ${roomNumber} is ${Math.round(Math.abs(pct || 0))} percent higher than the forecast prediction of ${Number(predicted || 0).toFixed(1)} kilowatt hours. ${facultyName ? `Please check the appliances in your assigned room. ` : ''}Thank you.`;
  return `<Response><Say loop="1">${escapeXml(text)}</Say></Response>`;
}

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Exotel REST (v1 Calls/connect). Uses Node's built-in fetch — no extra dependency. */
async function placeExotelCall({ to, callLogId }) {
  const { exotelSid, exotelApiToken, exotelFromNumber, exotelPublicBaseUrl, exotelCallerId } = env;
  if (!exotelSid || !exotelApiToken || !exotelFromNumber) {
    throw new Error('Exotel is selected but EXOTEL_ACCOUNT_SID / EXOTEL_API_TOKEN / EXOTEL_FROM_NUMBER are not configured in backend/.env');
  }
  if (!exotelPublicBaseUrl) {
    throw new Error('Exotel is selected but EXOTEL_PUBLIC_BASE_URL is missing. It must point to a public HTTPS URL where Exotel can fetch the answer script and post status callbacks (e.g. an ngrok tunnel: https://xxxx.ngrok-free.app).');
  }

  const ivrUrl = `${exotelPublicBaseUrl}/api/calls/${callLogId}/ivr`;
  const webhookUrl = `${exotelPublicBaseUrl}/api/calls/webhook`;

  const body = new URLSearchParams({
    From: exotelFromNumber,
    To: to,
    CallType: 'trans',
    Url: ivrUrl,
    StatusCallback: webhookUrl
  });
  if (exotelCallerId) body.set('CallerId', exotelCallerId);

  const res = await fetch(`https://api.exotel.com/v1/Accounts/${exotelSid}/Calls/connect`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${exotelSid}:${exotelApiToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Exotel error HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  const call = json?.rest_call || json?.call || json;
  const sid = call?.sid || call?.callSid || call?.id || '';
  if (!sid) throw new Error('Exotel accepted the request but returned no call SID.');
  return sid;
}

/** Demo mode: fabricate a call id and animate the lifecycle in the DB. */
function simulateDemoLifecycle(callId) {
  setTimeout(() => {
    CallLog.updateOne({ _id: callId }, { $set: { status: 'ringing' } }).catch(() => {});
  }, 3500);

  setTimeout(() => {
    const answered = Math.random() > 0.35;
    if (answered) {
      const started = new Date();
      CallLog.updateOne({ _id: callId }, { $set: { status: 'answered', startedAt: started } }).exec();
      setTimeout(() => {
        const ended = new Date();
        CallLog.updateOne(
          { _id: callId },
          { $set: { status: 'completed', endedAt: ended, duration: Math.round((ended - started) / 1000) } }
        ).exec();
      }, 20000);
    } else {
      CallLog.updateOne({ _id: callId }, { $set: { status: 'no-answer', endedAt: new Date() } }).exec();
    }
  }, 16000);
}

/**
 * Initiate a call to the given faculty for the given classroom.
 * Returns the persisted CallLog doc (lean-shaped via creation).
 */
export async function initiateCall({ classroom, faculty, adminId }) {
  const e164 = normalizeIndianMobile(faculty.phoneNumber);
  if (!e164) {
    throw new Error(`Faculty ${faculty.name} has no valid Indian mobile number (${faculty.phoneNumber || 'missing'}).`);
  }

  const log = await CallLog.create({
    classroomId: classroom._id,
    facultyId: faculty._id,
    facultyName: faculty.name,
    roomNumber: classroom.roomNumber,
    initiatedBy: adminId || null,
    phoneNumber: e164,
    provider: env.voiceProvider,
    status: 'initiated'
  });

  try {
    if (env.voiceProvider === 'exotel') {
      const sid = await placeExotelCall({ to: e164, callLogId: log._id });
      return await CallLog.findByIdAndUpdate(log._id, { providerCallId: sid }, { new: true }).lean();
    }
    const demoId = `DEMO-${reqId()}`;
    simulateDemoLifecycle(log._id);
    return await CallLog.findByIdAndUpdate(log._id, { providerCallId: demoId }, { new: true }).lean();
  } catch (err) {
    await CallLog.findByIdAndUpdate(log._id, {
      status: 'failed',
      endedAt: new Date(),
      failureReason: err.message
    });
    throw err;
  }
}

export default {
  ACTIVE_STATUSES,
  normalizeIndianMobile,
  isValidIndianMobile,
  maskPhoneNumber,
  mapExotelStatus,
  isTerminalStatus,
  hasActiveCall,
  buildIvRXml,
  initiateCall
};