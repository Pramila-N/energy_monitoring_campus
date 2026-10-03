import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, DoorOpen } from 'lucide-react';
import { usePolling } from '../hooks/useApi.js';
import api from '../api/client.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { PageLoader, ErrorState, EmptyState } from '../components/Feedback.jsx';
import { StatusBadge, OnOffBadge, RoomTypeTag } from '../components/Badges.jsx';
import { formatKwh, formatNumber, statusColor } from '../utils/format.js';

export default function Classrooms() {
  const { data, loading, error, refetch } = usePolling(() => api.get('/classrooms').then((r) => r.data), 60000);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const rooms = useMemo(() => {
    let list = data?.classrooms || [];
    if (q.trim()) list = list.filter((r) => r.roomNumber.toLowerCase().includes(q.trim().toLowerCase()));
    if (status) list = list.filter((r) => r.status === status);
    return list;
  }, [data, q, status]);

  if (loading) return <PageLoader label="Loading classrooms…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const counts = {
    normal: (data.classrooms || []).filter((r) => r.status === 'normal').length,
    warning: (data.classrooms || []).filter((r) => r.status === 'warning').length,
    abnormal: (data.classrooms || []).filter((r) => r.status === 'abnormal').length
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Classrooms"
        subtitle={`${data.classrooms?.length || 0} smart rooms across the campus`}
        icon={DoorOpen}
        actions={
          <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-slate-200">
            {[{ k: 'all', label: `All ${data.classrooms?.length || 0}` }, { k: 'normal', label: `${counts.normal} normal` }, { k: 'warning', label: `${counts.warning} warn` }, { k: 'abnormal', label: `${counts.abnormal} abnormal` }].map((f) => (
              <button
                key={f.k}
                onClick={() => setStatus(f.k === 'all' ? '' : f.k)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  (status === f.k || (f.k === 'all' && !status)) ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search room…" className="input pl-9" />
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <Filter size={13} /> {rooms.length} of {data.classrooms?.length || 0} rooms
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="th">Room</th>
                <th className="th">Faculty</th>
                <th className="th">Occupancy</th>
                <th className="th">Lights</th>
                <th className="th">Fans</th>
                <th className="th text-right">Actual</th>
                <th className="th text-right">Predicted</th>
                <th className="th text-right">Deviation</th>
                <th className="th text-right">Total/kWh</th>
                <th className="th">Status</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r._id} className="table-row">
                  <td className="td">
                    <Link to={`/classrooms/${r._id}`} className="font-bold text-brand-600 hover:underline">{r.roomNumber}</Link>
                    <p className="text-xs text-slate-400">{r.buildingId?.name || ''} · Floor {r.floor}</p>
                  </td>
                  <td className="td"><RoomTypeTag type={r.type} /><p className="mt-0.5 truncate text-xs text-slate-400">{r.facultyId?.name || 'Unassigned'}</p></td>
                  <td className="td">
                    <span className="font-semibold">{r.currentOccupancy}/{r.capacity}</span>
                    {r.expectedOccupancy > 0 && <span className="ml-1 text-xs text-slate-400">exp {r.expectedOccupancy}</span>}
                  </td>
                  <td className="td"><OnOffBadge value={r.lightStatus === 'on'} /></td>
                  <td className="td"><OnOffBadge value={r.fanStatus === 'on'} /></td>
                  <td className="td text-right font-semibold">{formatKwh(r.currentEnergy, 2)}</td>
                  <td className="td text-right text-slate-500">{formatKwh(r.predictedEnergy, 2)}</td>
                  <td className="td text-right">
                    <span className={`font-bold ${Math.abs(r.percentageDifference) > 20 ? 'text-danger' : Math.abs(r.percentageDifference) > 10 ? 'text-warn' : 'text-ok'}`}>
                      {r.percentageDifference > 0 ? '+' : ''}{formatNumber(r.percentageDifference, 1)}%
                    </span>
                  </td>
                  <td className="td text-right">{formatNumber(r.totalEnergy, 0)}</td>
                  <td className="td"><StatusBadge status={r.status} /></td>
                  <td className="td text-right">
                    <Link to={`/classrooms/${r._id}`} className="text-xs font-semibold text-brand-600 hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rooms.length === 0 && <div className="p-6"><EmptyState title="No rooms match" hint="Try a different search or status filter." /></div>}
        </div>
      </div>
    </div>
  );
}