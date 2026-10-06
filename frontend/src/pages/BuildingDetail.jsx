import { useParams, Link } from 'react-router-dom';
import { Building2, Zap, Users, AlertTriangle, DoorOpen, ArrowLeft } from 'lucide-react';
import { usePolling } from '../hooks/useApi.js';
import api from '../api/client.js';
import { PageLoader, ErrorState } from '../components/Feedback.jsx';
import { StatusBadge, OnOffBadge } from '../components/Badges.jsx';
import { formatKwh, formatNumber } from '../utils/format.js';

export default function BuildingDetail() {
  const { id } = useParams();
  const { data, loading, error, refetch } = usePolling(() => api.get(`/buildings/${id}`).then((r) => r.data), 60000);

  if (loading) return <PageLoader label="Loading building…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const b = data.building;
  const rooms = (data.rooms || []).slice().sort((a, bb) => bb.totalEnergy - a.totalEnergy);

  return (
    <div className="fade-in">
      <Link to="/buildings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
        <ArrowLeft size={15} /> Buildings
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Building2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800">{b.name}</h1>
              <span className="badge bg-slate-100 text-slate-500">{b.code}</span>
            </div>
            <p className="text-sm text-slate-500">
              {b.floors} floors · {b.areaSqft?.toLocaleString?.() || '—'} sq ft
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-xs font-semibold">
          <span className="badge bg-green-50 text-ok border border-green-200">Sensors operational</span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400"><Zap size={14} className="text-brand-500" /> Total energy</div>
          <p className="mt-1 text-xl font-bold">{formatNumber(rooms.reduce((s, r) => s + r.totalEnergy, 0), 0)} kWh</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400"><DoorOpen size={14} className="text-info" /> Rooms</div>
          <p className="mt-1 text-xl font-bold">{rooms.length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400"><Users size={14} className="text-info" /> Occupied now</div>
          <p className="mt-1 text-xl font-bold">{rooms.filter((r) => r.currentOccupancy > 0).length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400"><AlertTriangle size={14} className="text-danger" /> Abnormal</div>
          <p className="mt-1 text-xl font-bold">{rooms.filter((r) => r.status === 'abnormal').length}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-800">Rooms in this building</h3>
          <p className="text-xs text-slate-500">Energy consumption since deployment, newest status live</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="th">Room</th>
                <th className="th">Type</th>
                <th className="th">Occupancy</th>
                <th className="th">Lights</th>
                <th className="th">Fans</th>
                <th className="th text-right">Total usage</th>
                <th className="th text-right">Now</th>
                <th className="th">Status</th>
                <th className="th">Faculty phone</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r._id} className="table-row">
                  <td className="td">
                    <Link to={`/classrooms/${r._id}`} className="font-bold text-brand-600 hover:underline">{r.roomNumber}</Link>
                  </td>
                  <td className="td text-slate-500">{r.type.replaceAll('_', ' ')}</td>
                  <td className="td font-semibold">{r.currentOccupancy}/{r.capacity}</td>
                  <td className="td"><OnOffBadge value={r.lightStatus === 'on'} /></td>
                  <td className="td"><OnOffBadge value={r.fanStatus === 'on'} /></td>
                  <td className="td text-right font-semibold">{formatNumber(r.totalEnergy, 1)} kWh</td>
                  <td className="td text-right">{formatKwh(r.currentEnergy, 2)}</td>
                  <td className="td"><StatusBadge status={r.status} /></td>
                  <td className="td text-right">
                    {r.facultyId?.phoneNumber ? (
                      <a href={`tel:${r.facultyId.phoneNumber}`} className="font-semibold text-brand-600 hover:underline">
                        {r.facultyId.phoneNumber}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}