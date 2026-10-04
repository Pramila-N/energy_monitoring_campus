import { useMemo, useState } from 'react';
import { Bell, CheckCircle2, Filter, AlertTriangle, Lightbulb } from 'lucide-react';
import { usePolling } from '../hooks/useApi.js';
import api from '../api/client.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { PageLoader, ErrorState, EmptyState } from '../components/Feedback.jsx';
import { SeverityBadge, AlertTypeTag, StatusBadge, RecTypeTag } from '../components/Badges.jsx';
import { Modal } from '../components/Modal.jsx';
import CallFaculty from '../components/CallFaculty.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatKwh, formatPct, formatNumber, formatTimeStamp } from '../utils/format.js';

const TABS = [
  { k: '', label: 'All' },
  { k: 'active', label: 'Active' },
  { k: 'contacted', label: 'Contacted' },
  { k: 'resolved', label: 'Resolved' }
];

function PriorityBadge({ p }) {
  const cls = p === 'high' ? 'bg-red-50 text-danger border border-red-200' : p === 'medium' ? 'bg-amber-50 text-warn border border-amber-200' : 'bg-sky-50 text-info border border-sky-200';
  return <span className={`badge ${cls}`}>{p}</span>;
}

export default function Alerts() {
  const toast = useToast();
  const [tab, setTab] = useState('');
  const [severity, setSeverity] = useState('');
  const [resolveTarget, setResolveTarget] = useState(null);
  const [note, setNote] = useState('');
  const [busyRecId, setBusyRecId] = useState(null);

  const { data, loading, error, refetch } = usePolling(() => api.get('/alerts').then((r) => r.data), 60000);
  const recsData = usePolling(() => api.get('/recommendations?status=active&limit=250').then((r) => r.data.recommendations), 60000);

  const alerts = useMemo(() => {
    let list = data?.alerts || [];
    if (tab) list = list.filter((a) => a.status === tab);
    if (severity) list = list.filter((a) => a.severity === severity);
    return list;
  }, [data, tab, severity]);

  const recsByRoom = useMemo(() => {
    const map = {};
    for (const r of recsData.data || []) {
      const key = (r.roomId?._id || r.roomId)?.toString();
      if (!key) continue;
      (map[key] = map[key] || []).push(r);
    }
    return map;
  }, [recsData]);

  const recsForAlert = (a) => {
    const key = (a.roomId?._id || a.roomId)?.toString();
    const roomRecs = key ? recsByRoom[key] || [] : [];
    if (!roomRecs.length) return [];
    const exact = roomRecs.filter((r) => r.type === a.type);
    return exact.length ? exact : roomRecs;
  };

  if (loading && !data) return <PageLoader label="Loading alerts…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const all = data?.alerts || [];
  const counts = {
    active: all.filter((a) => a.status === 'active').length,
    contacted: all.filter((a) => a.status === 'contacted').length,
    resolved: all.filter((a) => a.status === 'resolved').length
  };

  const resolve = async () => {
    if (!resolveTarget) return;
    try {
      await api.post(`/alerts/${resolveTarget._id}/resolve`, { resolutionNote: note });
      toast.success('Alert resolved.');
      setResolveTarget(null);
      setNote('');
      refetch();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to resolve');
    }
  };

  const applyRec = async (rec) => {
    setBusyRecId(rec._id);
    try {
      const roomId = (rec.roomId?._id || rec.roomId)?.toString();
      await api.post(`/recommendations/${roomId}/${rec.type}/resolve`);
      toast.success('AI recommendation applied & resolved.');
      refetch();
      recsData.refetch();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to apply recommendation');
    } finally {
      setBusyRecId(null);
    }
  };

  return (
    <div className="fade-in space-y-5">
      <PageHeader
        title="Alerts"
        subtitle={`${all.length} alerts · ${counts.active} active · ${counts.contacted} contacted · ${counts.resolved} resolved — AI suggestions attached to each alert`}
        icon={Bell}
        actions={
          <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-slate-200">
            {TABS.map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${tab === t.k ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {t.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Filter size={14} className="text-slate-400" />
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="input w-40">
          <option value="">All severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="divide-y divide-slate-100">
          {alerts.length === 0 && <div className="p-8"><EmptyState title="No alerts" hint="Nothing matching this filter." /></div>}
          {alerts.map((a) => {
            const resolved = a.status === 'resolved';
            const related = recsForAlert(a);
            return (
              <div key={a._id} className={`px-5 py-4 ${resolved ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={a.severity} />
                      <AlertTypeTag type={a.type} />
                      <StatusBadge status={a.status} />
                      {!resolved && a.facultyName && <span className="text-xs text-slate-400">→ {a.facultyName}</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{a.message}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Room <span className="font-bold text-slate-700">{a.roomId?.roomNumber || '—'}</span></span>
                      <span>Actual <span className="font-bold">{formatKwh(a.actualEnergy, 2)}</span></span>
                      <span>Predicted <span className="font-bold">{formatKwh(a.predictedEnergy, 2)}</span></span>
                      <span>Deviation <span className={`font-bold ${Math.abs(a.percentageDifference) > 20 ? 'text-danger' : 'text-warn'}`}>{formatPct(a.percentageDifference)}</span></span>
                      <span>Occupancy <span className="font-bold">{formatNumber(a.occupancy)}</span></span>
                      <span>{formatTimeStamp(a.createdAt)}</span>
                    </div>
                    {a.resolutionNote && <p className="text-xs text-slate-400">Resolution: {a.resolutionNote}</p>}
                  </div>
                  {!resolved && (
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <CallFaculty
                        classroomId={a.roomId?._id || a.roomId}
                        roomNumber={a.roomId?.roomNumber}
                        facultyName={a.facultyName}
                      />
                      <button className="btn-success py-1.5 text-xs" onClick={() => setResolveTarget(a)}>
                        <CheckCircle2 size={12} /> Resolve
                      </button>
                    </div>
                  )}
                </div>

                {related.length > 0 && (
                  <div className={`mt-3 rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 ${resolved ? 'opacity-70' : ''}`}>
                    <div className="mb-2 flex items-center gap-1.5">
                      <Lightbulb size={13} className="text-ai" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ai">AI optimization for this alert</span>
                    </div>
                    <div className="space-y-2">
                      {related.map((rec) => (
                        <div key={rec._id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-white/80 px-3 py-2.5 ring-1 ring-violet-100">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-700">{rec.message}</p>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{rec.reason}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <RecTypeTag type={rec.type} />
                              <PriorityBadge p={rec.priority} />
                            </div>
                          </div>
                          {rec.status === 'active' && (
                            <button className="btn-success py-1.5 text-xs" disabled={busyRecId === rec._id} onClick={() => applyRec(rec)}>
                              <CheckCircle2 size={13} /> Apply & resolve
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={Boolean(resolveTarget)} onClose={() => setResolveTarget(null)} title="Resolve alert" width="max-w-md">
        {resolveTarget && (
          <>
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-slate-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" />
              {resolveTarget.message}
            </div>
            <label className="label">Resolution note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Fan bank left on after class ended; switched off manually. Faculty informed."
              className="input"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setResolveTarget(null)}>Cancel</button>
              <button className="btn-success" onClick={resolve}>Mark resolved</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}