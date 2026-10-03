import { useMemo, useState } from 'react';
import { Zap, Gauge, Activity, Droplets, Building2 } from 'lucide-react';
import { usePolling } from '../hooks/useApi.js';
import api from '../api/client.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { PageLoader, ErrorState, EmptyState, Spinner } from '../components/Feedback.jsx';
import { ChartCard, CurrentSeries, CHART_COLORS } from '../components/charts.jsx';
import { formatNumber, formatTimeStamp, formatKwh } from '../utils/format.js';

export default function Energy() {
  const [buildingId, setBuildingId] = useState('');
  const [roomId, setRoomId] = useState('');

  const grades = usePolling(() => api.get('/classrooms').then((r) => r.data), 60000);
  const buildings = usePolling(() => api.get('/buildings').then((r) => r.data.buildings), 60000);

  const readings = usePolling(
    () => api.get(`/energy/readings${buildingId ? `?buildingId=${buildingId}` : ''}`).then((r) => r.data.readings),
    8000,
    true
  );

  const series = usePolling(() => (roomId ? api.get(`/energy/${roomId}/series?hours=12`).then((r) => r.data) : Promise.resolve(null)), 60000, Boolean(roomId));

  if (readings.loading && !readings.data) return <PageLoader label="Streaming power readings…" />;
  if (readings.error) return <ErrorState message={readings.error} onRetry={readings.refetch} />;

  const list = readings.data || [];
  const avg = (k) => {
    if (!list.length) return 0;
    return list.reduce((s, r) => s + (Number(r[k]) || 0), 0) / list.length;
  };

  const seriesData = (series.data?.series || []).map((pt) => ({
    label: new Date(pt.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    kw: Number((pt.hourlyRate || 0).toFixed(3)),
    occupancy: Number(pt.occupancy || 0)
  }));

  const selectedRoom = roomId ? grades.data?.classrooms?.find((r) => r._id === roomId) : null;

  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="Energy Monitors"
        subtitle="Real-time smart-meter telemetry from every connected room"
        icon={Zap}
        actions={
          <div className="flex gap-2">
            <div className="relative">
              <Building2 size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} className="input w-48 pl-9">
                <option value="">All buildings</option>
                {(buildings.data || []).map((b) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Zap size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="input w-56 pl-9">
                <option value="">Select room for chart…</option>
                {(grades.data?.classrooms || []).map((r) => (
                  <option key={r._id} value={r._id}>{r.buildingId?.code}-{r.roomNumber}</option>
                ))}
              </select>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: 'Voltage (avg)', value: `${avg('voltage').toFixed(1)} V`, icon: Gauge, color: 'text-brand-500 bg-brand-50' },
          { label: 'Current (avg)', value: `${avg('current').toFixed(2)} A`, icon: Activity, color: 'text-info bg-sky-50' },
          { label: 'Power (avg)', value: `${formatNumber(avg('hourlyRate') * 1000, 0)} W`, icon: Zap, color: 'text-warn bg-amber-50' },
          { label: 'Meter samples', value: `${formatNumber(list.length)}`, icon: Droplets, color: 'text-ai bg-violet-50' }
        ].map((c) => (
          <div key={c.label} className="card flex items-center gap-4 p-5">
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${c.color}`}>
              <c.icon size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="text-xl font-bold text-slate-800">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard
            title={selectedRoom ? `${selectedRoom.buildingId?.code}-${selectedRoom.roomNumber} consumption` : 'Selected room consumption'}
            subtitle={selectedRoom ? 'Power draw over the last ~12 hours' : 'Pick a room from the filter above'}
          >
            {!roomId || series.loading ? (
              <div className="flex h-[260px] items-center justify-center text-slate-400">
                <Spinner size={22} />
              </div>
            ) : (
              <CurrentSeries data={seriesData} series={[{ key: 'kw', name: 'kW', color: CHART_COLORS.energy }]} />
            )}
          </ChartCard>
        </div>

        <ChartCard title="Usage table" subtitle="Most recent meter samples">
          <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
            {list.length === 0 && <EmptyState title="No readings yet" />}
            {list.slice(0, 40).map((r) => (
              <div key={r._id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-slate-700">{r.roomId?.roomNumber || '—'}</p>
                  <p className="truncate text-slate-400">{formatTimeStamp(r.timestamp)} · {r.source}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">{formatKwh(r.energyConsumption, 3)}</p>
                  {r.anomalous && <span className="badge bg-red-50 text-danger border border-red-200">anomaly</span>}
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}