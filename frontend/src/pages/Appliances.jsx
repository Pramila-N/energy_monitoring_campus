import { Link } from 'react-router-dom';
import { Lightbulb, Fan, Plug, ZapOff, AlertTriangle, Leaf, Users } from 'lucide-react';
import { usePolling } from '../hooks/useApi.js';
import api from '../api/client.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { PageLoader, ErrorState, EmptyState } from '../components/Feedback.jsx';
import { OnOffBadge, StatusBadge } from '../components/Badges.jsx';
import { formatNumber } from '../utils/format.js';

export default function Appliances() {
  const { data, loading, error, refetch } = usePolling(() => api.get('/appliances').then((r) => r.data), 60000);

  if (loading) return <PageLoader label="Loading appliance status…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const s = data.summary;
  const rooms = data.rooms || [];

  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Appliance Control" subtitle="Light & fan automation across all smart rooms" icon={Plug} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-warn"><Lightbulb size={20} /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lights ON</p>
            <p className="text-xl font-bold text-slate-800">{s.activeLights}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-info"><Fan size={20} /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fans ON</p>
            <p className="text-xl font-bold text-slate-800">{s.activeFans}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-50 text-ok"><ZapOff size={20} /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auto-switched OFF</p>
            <p className="text-xl font-bold text-slate-800">{s.automaticOff}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 text-danger"><AlertTriangle size={20} /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wasted energy</p>
            <p className="text-xl font-bold text-slate-800">{s.potentialIssue}</p>
            <p className="text-[11px] text-slate-400">empty rooms, appliances on</p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-800">Room appliance status</h3>
          <p className="text-xs text-slate-500">Automation switches lights/fans off when no presence is detected</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="th">Room</th>
                <th className="th">Occupancy</th>
                <th className="th">Lights</th>
                <th className="th">Fans</th>
                <th className="th text-right">Saving now</th>
                <th className="th">Status</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r._id} className="table-row">
                  <td className="td">
                    <Link to={`/classrooms/${r._id}`} className="font-bold text-brand-600 hover:underline">{r.buildingId?.code}-{r.roomNumber}</Link>
                  </td>
                  <td className="td">
                    <span className="inline-flex items-center gap-1.5"><Users size={13} className="text-slate-300" />{r.currentOccupancy}/{r.capacity}</span>
                  </td>
                  <td className="td"><OnOffBadge value={r.lightStatus === 'on'} /></td>
                  <td className="td"><OnOffBadge value={r.fanStatus === 'on'} /></td>
                  <td className="td text-right">
                    <span className="font-bold text-ok">{r.savingNow > 0.0001 ? formatNumber(r.savingNow * 1000, 1) : '0'} W</span>
                  </td>
                  <td className="td"><StatusBadge status={r.status} /></td>
                  <td className="td text-right">
                    <Link to={`/classrooms/${r._id}`} className="text-xs font-semibold text-brand-600 hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rooms.length === 0 && <div className="p-6"><EmptyState title="No rooms" /></div>}
        </div>
      </div>
    </div>
  );
}