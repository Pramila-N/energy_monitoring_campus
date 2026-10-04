import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneCall, PhoneMissed, AlertTriangle } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Modal } from './Modal.jsx';
import { timeAgo } from '../utils/format.js';

const TERMINAL = ['completed', 'busy', 'no-answer', 'failed'];
const LIVE = ['initiated', 'ringing', 'answered', 'in-progress'];

function formatElapsed(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function StatusChip({ status, duration, reason }) {
  if (status === 'initiated') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><PhoneCall size={12} className="animate-pulse" /> Initiating…</span>;
  if (status === 'ringing') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><PhoneCall size={12} className="animate-pulse" /> Ringing…</span>;
  if (status === 'answered' || status === 'in-progress') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><Phone size={12} /> Connected · {formatElapsed(duration)}</span>;
  if (status === 'completed') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><PhoneCall size={12} /> Completed · {formatElapsed(duration)}</span>;
  if (status === 'no-answer') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400"><PhoneMissed size={12} /> No Answer</span>;
  if (status === 'busy') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger"><PhoneMissed size={12} /> Busy</span>;
  if (status === 'failed') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger"><PhoneMissed size={12} /> Failed{reason ? ` — ${reason}` : ''}</span>;
  return null;
}

/**
 * Real faculty-calling button:
 *  Pop confirm → POST /api/calls/faculty → poll GET /api/calls/status/:classroomId
 *  until the provider reports a terminal status. Uses the backend (Exotel in
 *  production, simulated lifecycle in demo mode). Never displays the number.
 */
export default function CallFaculty({ classroomId, roomNumber, facultyName, disabled = false, compact = false }) {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | active | done
  const [call, setCall] = useState(null); // live/current call
  const [lastCall, setLastCall] = useState(null); // most recent finished call
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef(null);

  const loadStatus = async (silent = false) => {
    try {
      const { data } = await api.get(`/calls/status/${classroomId}`);
      const live = data?.lastCall && LIVE.includes(data.lastCall.status) ? data.lastCall : null;
      if (live && !silent) {
        setPhase('active');
        setCall(live);
        return;
      }
      setLastCall(data?.lastCall || null);
      if (!live) setPhase((p) => (p === 'active' ? 'done' : p));
      if (live) {
        setCall(live);
        setLastCall(null);
      }
    } catch (e) {
      if (!silent) toast.error('Could not load call status.');
    }
  };

  useEffect(() => {
    loadStatus(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId]);

  // Poll status while a call is active; stop on terminal.
  useEffect(() => {
    if (phase !== 'active') return undefined;
    pollRef.current = setInterval(() => {
      api
        .get(`/calls/status/${classroomId}`)
        .then(({ data }) => {
          const c = data?.lastCall || call;
          setCall(c);
          if (c && TERMINAL.includes(c.status)) {
            setPhase('done');
            setLastCall(c);
            toast.info(`Call ${c.status === 'completed' ? 'completed' : c.status === 'no-answer' ? 'unanswered' : c.status}.`);
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, classroomId]);

  // ticking seconds while connected
  useEffect(() => {
    if (!(call?.status === 'answered' || call?.status === 'in-progress')) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [call?.status, call?._id]);

  const connectedSeconds = () => {
    if (!call?.startedAt) return 0;
    const end = call.endedAt || new Date(now);
    return Math.floor((new Date(end).getTime() - new Date(call.startedAt).getTime()) / 1000);
  };

  const initiate = async () => {
    setBusy(true);
    setConfirmOpen(false);
    try {
      const { data } = await api.post('/calls/faculty', { classroomId });
      setPhase('active');
      setCall({ status: data.status || 'initiated', startedAt: null, endedAt: null, duration: 0, failureReason: '' });
      toast.success(`Call initiated — calling ${data.facultyName}…`);
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to initiate the call';
      if (e?.response?.status === 409) toast.warning(msg);
      else toast.error(msg);
      setPhase('idle');
      loadStatus(true);
    } finally {
      setBusy(false);
    }
  };

  const status = call?.status || (lastCall && LIVE.includes(lastCall.status) ? lastCall.status : null) || null;
  const showChip = phase === 'active' || phase === 'done';

  const buttonLabel = () => {
    if (busy) return 'Calling…';
    return compact ? 'Call faculty' : 'Call Faculty';
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-2">
        {showChip && (
          <StatusChip
            status={status}
            duration={status === 'completed' ? (call?.duration || connectedSeconds()) : connectedSeconds()}
            reason={call?.failureReason}
          />
        )}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={disabled || busy || phase === 'active' || (lastCall && LIVE.includes(lastCall.status))}
          className={
            compact
              ? `inline-flex items-center gap-1 text-xs font-semibold transition-colors ${
                  disabled ? 'cursor-not-allowed text-slate-300' : 'text-brand-600 hover:underline'
                }`
              : `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  disabled ? 'cursor-not-allowed bg-slate-100 text-slate-300'
                  : 'bg-brand-600 text-white shadow-sm hover:bg-brand-700'
                }`
          }
          title={disabled ? 'No faculty assigned to this room' : `Call ${facultyName || 'assigned faculty'}`}
        >
          <Phone size={12} /> {busy ? 'Calling…' : buttonLabel()}
        </button>
      </span>
      {lastCall && !LIVE.includes(lastCall.status) && phase !== 'active' && (
        <span className="text-[11px] text-slate-400">Last call: {timeAgo(lastCall.endedAt || lastCall.createdAt)}</span>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Call assigned faculty?" width="max-w-md">
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
          <p>Faculty: <span className="font-semibold text-slate-800">{facultyName || 'Assigned faculty'}</span></p>
          <p>Classroom: <span className="font-semibold text-slate-800">{roomNumber || '—'}</span></p>
          <p className="flex items-start gap-1.5 text-xs text-slate-500">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn" />
            The system will initiate a real telephone call to the faculty's mobile phone so they can check the appliances.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={initiate}>
            <Phone size={13} /> {busy ? 'Initiating…' : 'Call Faculty'}
          </button>
        </div>
      </Modal>
    </span>
  );
}