import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Zap, Users, AlertTriangle, ArrowRight, Search, DoorOpen, Filter } from 'lucide-react';
import { usePolling } from '../hooks/useApi.js';
import api from '../api/client.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { PageLoader, ErrorState, EmptyState } from '../components/Feedback.jsx';
import { StatusBadge, OnOffBadge, RoomTypeTag } from '../components/Badges.jsx';
import CallFaculty from '../components/CallFaculty.jsx';
import { formatKwh, formatNumber } from '../utils/format.js';

export default function Campus() {
  const buildingsApi = usePolling(() => api.get('/buildings').then((r) => r.data), 60000);
  const roomsApi = usePolling(() => api.get('/classrooms').then((r) => r.data), 60000);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const buildings = buildingsApi.data?.buildings || [];
  const allRooms = roomsApi.data?.classrooms || [];

  const rooms = useMemo(() => {
    let list = allRooms;
    if (q.trim()) list = list.filter((r) => r.roomNumber.toLowerCase().includes(q.trim().toLowerCase()));
    if (status) list = list.filter((r) => r.status === status);
    return list;
  }, [allRooms, q, status]);

  if (buildingsApi.loading && !buildingsApi.data) return <PageLoader label="Loading campus overview…" />;
  if (buildingsApi.error) return <ErrorState message={buildingsApi.error} onRetry={buildingsApi.refetch} />;

  const counts = {
    normal: allRooms.filter((r) => r.status === 'normal').length,
    warning: allRooms.filter((r) => r.status === 'warning').length,
    abnormal: allRooms.filter((r) => r.status === 'abnormal').length
  };
  const maxEnergy = Math.max(...buildings.map((b) => b.energyToday), 1);

  return (
    <div className="fade-in space-y-8">
      <PageHeader
        title="Buildings & Classrooms"
        subtitle={`${buildings.length} buildings · ${allRooms.length} smart rooms — live status everywhere`}
        icon={Building2}
      />

      {/* ---- Buildings ---- */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Buildings</h2>
          <span className="badge bg-slate-100 text-slate-500">{buildings.length} total</span>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {buildings.map((b) => (
            <Link key={b._id} to={`/buildings/${b._id}`} className="card group p-5 transition-all hover:-translate-y-0.5 hover:shadow-pop">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                  <Building2 size={20} />
                </div>
                <span className="badge bg-slate-100 text-slate-500">{b.code}</span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-800">{b.name}</h3>
              <p className="text-xs text-slate-400">{b.floors} floors · {b.areaSqft?.toLocaleString?.() || '—'} sq ft</p>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 px-2 py-2.5">
                  <Zap size={14} className="mx-auto mb-1 text-brand-500" />
                  <p className="text-sm font-bold text-slate-800">{formatNumber(b.energyToday, 0)}</p>
                  <p className="text-[10px] uppercase text-slate-400">kWh today</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-2.5">
                  <Users size={14} className="mx-auto mb-1 text-info" />
                  <p className="text-sm font-bold text-slate-800">{b.occupiedRooms}/{b.totalRooms}</p>
                  <p className="text-[10px] uppercase text-slate-400">rooms live</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-2.5">
                  <AlertTriangle size={14} className={`mx-auto mb-1 ${b.abnormalRooms > 0 ? 'text-danger' : 'text-ok'}`} />
                  <p className="text-sm font-bold text-slate-800">{b.abnormalRooms}</p>
                  <p className="text-[10px] uppercase text-slate-400">abnormal</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[11px] font-medium text-slate-400">
                  <span>Usage vs campus</span>
                  <span>{Math.round((b.energyToday / maxEnergy) * 100)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-ai" style={{ width: `${(b.energyToday / maxEnergy) * 100}%` }} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end text-xs font-semibold text-brand-600 group-hover:text-brand-700">
                View detail <ArrowRight size={14} className="ml-1 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Classrooms ---- */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Classrooms</h2>
          <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-slate-200">
            {[{ k: 'all', label: `All ${allRooms.length}` }, { k: 'normal', label: `${counts.normal} normal` }, { k: 'warning', label: `${counts.warning} warn` }, { k: 'abnormal', label: `${counts.abnormal} abnormal` }].map((f) => (
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
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search room…" className="input pl-9" />
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <Filter size={13} /> {rooms.length} of {allRooms.length} rooms
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
                      <CallFaculty
                        compact
                        classroomId={r._id}
                        roomNumber={r.roomNumber}
                        facultyName={r.facultyId?.name}
                        disabled={!r.facultyId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rooms.length === 0 && <div className="p-6"><EmptyState title="No rooms match" hint="Try a different search or status filter." /></div>}
          </div>
        </div>
      </section>
    </div>
  );
}