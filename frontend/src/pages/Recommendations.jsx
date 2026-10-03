import { useMemo, useState } from 'react';
import { Lightbulb, CheckCircle2, RefreshCw } from 'lucide-react';
import { usePolling } from '../hooks/useApi.js';
import api from '../api/client.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { PageLoader, ErrorState, EmptyState } from '../components/Feedback.jsx';
import { RecTypeTag } from '../components/Badges.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatKwh, formatPct, formatTimeStamp } from '../utils/format.js';

const TABS = [
  { k: 'active', label: 'Active' },
  { k: 'resolved', label: 'Resolved' }
];

function PriorityBadge({ p }) {
  const cls = p === 'high' ? 'bg-red-50 text-danger border border-red-200' : p === 'medium' ? 'bg-amber-50 text-warn border border-amber-200' : 'bg-sky-50 text-info border border-sky-200';
  return <span className={`badge ${cls}`}>{p}</span>;
}

export default function Recommendations() {
  const toast = useToast();
  const [tab, setTab] = useState('active');
  const [regenerating, setRegenerating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const { data, loading, error, refetch } = usePolling(() => api.get('/recommendations').then((r) => r.data), 60000);

  const recs = useMemo(() => (data?.recommendations || []).filter((r) => r.status === tab), [data, tab]);
  const counts = useMemo(() => {
    const list = data?.recommendations || [];
    return { active: list.filter((r) => r.status === 'active').length, resolved: list.filter((r) => r.status === 'resolved').length };
  }, [data]);

  if (loading && !data) return <PageLoader label="Loading recommendations…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const resolve = async (r) => {
    setBusyId(r._id);
    try {
      await api.post(`/recommendations/${r.roomId}/${r.type}/resolve`);
      toast.success('Recommendation marked as resolved.');
      refetch();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to resolve');
    } finally {
      setBusyId(null);
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const { data: d } = await api.post('/recommendations/generate');
      toast.success(d.message || 'Recommendations re-evaluated.');
      refetch();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to re-evaluate');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Optimization Recommendations"
        subtitle="AI-generated actions to reduce energy waste without affecting teaching"
        icon={Lightbulb}
        actions={
          <>
            <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-slate-200">
              {TABS.map((t) => (
                <button key={t.k} onClick={() => setTab(t.k)} className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${tab === t.k ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {t.label} {counts[t.k]}
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={regenerate} disabled={regenerating}>
              <RefreshCw size={14} className={regenerating ? 'spin' : ''} /> Re-evaluate
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {recs.length === 0 && <div className="lg:col-span-2"><EmptyState title="Nothing here" hint="No recommendations in this state." /></div>}
        {recs.map((r) => {
          const room = r.roomId;
          return (
            <div key={r._id} className={`card p-5 ${r.status === 'resolved' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-ai">
                    <Lightbulb size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{room?.roomNumber || '—'} · {room?.name || ''}</p>
                    <p className="text-xs text-slate-400">{room?.buildingId?.name || ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RecTypeTag type={r.type} />
                  <PriorityBadge p={r.priority} />
                </div>
              </div>

              <p className="mt-3 text-sm font-medium text-slate-700">{r.message}</p>
              <p className="mt-1 text-xs text-slate-500">{r.reason}</p>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Status: <span className="font-bold">{r.status}</span></span>
                  <span>{formatTimeStamp(r.createdAt)}</span>
                  {room?.currentOccupancy !== undefined && <span>occ {room.currentOccupancy}</span>}
                  {r.status === 'resolved' && r.resolvedAt && <span>resolved {formatTimeStamp(r.resolvedAt)}</span>}
                </div>
                {r.status === 'active' && (
                  <button className="btn-success py-1.5 text-xs" disabled={busyId === r._id} onClick={() => resolve(r)}>
                    <CheckCircle2 size={13} /> Apply & resolve
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}