import { Link } from 'react-router-dom';
import { Building2, Zap, Users, AlertTriangle, ArrowRight } from 'lucide-react';
import { usePolling } from '../hooks/useApi.js';
import api from '../api/client.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { PageLoader, ErrorState } from '../components/Feedback.jsx';
import { formatNumber } from '../utils/format.js';

export default function Buildings() {
  const { data, loading, error, refetch } = usePolling(() => api.get('/buildings').then((r) => r.data), 60000);

  if (loading) return <PageLoader label="Loading buildings…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const buildings = data.buildings || [];
  const maxEnergy = Math.max(...buildings.map((b) => b.energyToday), 1);

  return (
    <div className="fade-in">
      <PageHeader title="Buildings" subtitle={`${buildings.length} campus buildings with smart meters`} icon={Building2} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {buildings.map((b) => (
          <Link key={b._id} to={`/buildings/${b._id}`} className="card group p-5 transition-all hover:-translate-y-0.5 hover:shadow-pop">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                <Building2 size={20} />
              </div>
              <span className="badge bg-slate-100 text-slate-500">{b.code}</span>
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-800">{b.name}</h3>
            <p className="text-xs text-slate-400">
              {b.floors} floors · {b.areaSqft?.toLocaleString?.() || b.areaSqft || '—'} sq ft
            </p>

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
    </div>
  );
}