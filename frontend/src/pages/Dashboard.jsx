import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Leaf,
  Activity,
  AlertTriangle,
  DoorOpen,
  Bell,
  BrainCircuit,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Building2,
  Plug
} from 'lucide-react';
import { usePolling } from '../hooks/useApi.js';
import api from '../api/client.js';
import { StatCard } from '../components/StatCard.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { PageLoader, ErrorState, EmptyState, Spinner } from '../components/Feedback.jsx';
import { StatusBadge, SeverityBadge, OnOffBadge, RoomTypeTag } from '../components/Badges.jsx';
import { ChartCard, ConsumptionArea, SimpleBars, ProgressBar, CHART_COLORS } from '../components/charts.jsx';
import { formatNumber, formatKwh, formatPct, timeAgo, statusColor } from '../utils/format.js';

function bucketCampusTrend(readings) {
  if (!Array.isArray(readings)) return [];
  return readings.map((r) => ({
    label: String(r._id || '').slice(11, 16),
    energy: Number(r.energy || 0),
    anomalous: Number(r.anomalous || 0)
  }));
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function DeltaChip({ pct }) {
  const abs = Math.abs(Number(pct) || 0);
  const up = Number(pct) > 0;
  const cls = abs > 20 ? 'text-danger bg-red-50' : abs > 10 ? 'text-warn bg-amber-50' : 'text-ok bg-green-50';
  const Icon = Number(pct) >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`badge border ${cls} border-current`}>
      <Icon size={12} />
      {formatPct(Math.abs(Number(pct) || 0))}
    </span>
  );
}

export default function Dashboard() {
  const { data, loading, error, refetch } = usePolling(() => api.get('/dashboard/summary').then((r) => r.data), 60000);
  const trend = usePolling(() => api.get('/energy/readings?bucket=hour&limit=48').then((r) => r.data.readings), 60000);
  const month = usePolling(() => api.get('/reports?type=month').then((r) => r.data), 60000);
  const daily = usePolling(() => api.get('/reports?type=day').then((r) => r.data), 60000);

  const trendData = useMemo(() => (trend.data ? bucketCampusTrend(trend.data) : []), [trend.data]);

  if (loading || !data) return <PageLoader label="Loading live campus energy…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const s = data.summary;
  const rooms = (data.rooms || []).slice().sort((a, b) => b.percentageDifference - a.percentageDifference);
  const buildings = month.data?.byBuilding || [];
  const topRooms = (daily.data?.byRoom || []).slice().sort((a, b) => b.energy - a.energy).slice(0, 6);
  const abnormalRooms = rooms.filter((r) => r.status === 'abnormal');
  const warningRooms = rooms.filter((r) => r.status === 'warning');

  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="Operations Dashboard"
        subtitle={`Live overview — ${formatNumber(s.totalRooms)} rooms, ${formatNumber(s.activeRooms)} occupied now`}
        icon={Activity}
        actions={
          <Link to="/predictions" className="btn-secondary">
            <BrainCircuit size={15} className="text-ai" />
            AI Forecasts
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Energy today" value={formatKwh(s.totalEnergyToday, 1)} sub={`${formatNumber(s.readingsToday)} readings`} icon={Zap} accent="brand" loading={loading} />
        <StatCard label="Energy saved" value={formatKwh(s.energySavedToday, 1)} sub="vs appliance baseline" icon={Leaf} accent="ok" loading={loading} />
        <StatCard label="Active rooms" value={`${s.activeRooms}/${s.totalRooms}`} sub="occupancy detected" icon={DoorOpen} accent="info" loading={loading} />
        <StatCard label="Abnormal rooms" value={formatNumber(s.abnormalRooms)} sub="consumption above predicted" icon={AlertTriangle} accent="danger" loading={loading} />
        <StatCard label="Active alerts" value={formatNumber(data.alerts?.length || 0)} sub={`${formatNumber(warningRooms.length)} near-threshold`} icon={Bell} accent="warn" loading={loading} />
        <StatCard label="Live draw rate" value={formatKwh(s.actualRateNow)} sub={`${formatKwh(s.predictedRateNow)} predicted`} icon={Plug} accent="ai" loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard
            title="Campus consumption"
            subtitle="Sum of all energy meters (kWh per 30-min slot)"
            right={
              <div className="flex gap-3 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 text-danger">
                  <span className="h-2 w-2 rounded-full bg-danger" /> abnormal slots
                </span>
              </div>
            }
          >
            {trend.loading && !trendData.length ? (
              <div className="flex h-[260px] items-center justify-center text-slate-400">
                <Spinner size={22} />
              </div>
            ) : (
              <ConsumptionArea
                data={trendData}
                series={[
                  { key: 'energy', name: 'Consumption (kWh)', color: CHART_COLORS.energy }
                ]}
              />
            )}
          </ChartCard>
        </div>

        <ChartCard title="Buildings" subtitle="Energy since last month">
          {!month.data || month.loading ? (
            <div className="flex h-[260px] items-center justify-center text-slate-400">
              <Spinner size={22} />
            </div>
          ) : (
            <div className="space-y-4">
              {buildings.map((b) => (
                <div key={b.buildingId} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Building2 size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate font-semibold text-slate-700">{b.name.replace(' Building', '')}</span>
                      <span className="font-bold text-slate-800">{formatNumber(b.energy, 0)} kWh</span>
                    </div>
                    <ProgressBar value={b.energy} max={Math.max(...buildings.map((x) => x.energy), 1)} color="bg-gradient-to-r from-brand-500 to-ai" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Live room consumption</h3>
                <p className="text-xs text-slate-500">Actual vs AI-predicted · sorted by deviation</p>
              </div>
              <Link to="/campus" className="btn-ghost py-1.5 text-xs">
                View all rooms
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="th">Room</th>
                    <th className="th">Type</th>
                    <th className="th">Occupancy</th>
                    <th className="th">Lights</th>
                    <th className="th">Fans</th>
                    <th className="th text-right">Actual</th>
                    <th className="th text-right">Predicted</th>
                    <th className="th text-right">Deviation</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.slice(0, 12).map((r) => (
                    <tr key={r._id} className="table-row">
                      <td className="td">
                        <Link to={`/classrooms/${r._id}`} className="font-bold text-brand-600 hover:underline">
                          {r.buildingId?.code}-{r.roomNumber}
                        </Link>
                        <p className="truncate text-xs text-slate-400">{r.facultyId?.name || 'Unassigned'}</p>
                      </td>
                      <td className="td"><RoomTypeTag type={r.type} /></td>
                      <td className="td">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                          <Users size={13} className={r.currentOccupancy > 0 ? 'text-info' : 'text-slate-300'} />
                          {r.currentOccupancy}/{r.capacity}
                        </span>
                        {r.presenceDetected && <span className="ml-1 text-[10px] font-bold text-ok">PRESENCE</span>}
                      </td>
                      <td className="td"><OnOffBadge value={r.lightStatus === 'on'} /></td>
                      <td className="td"><OnOffBadge value={r.fanStatus === 'on'} /></td>
                      <td className="td text-right font-semibold">{formatKwh(r.currentEnergy, 2)}</td>
                      <td className="td text-right text-slate-500">{formatKwh(r.predictedEnergy, 2)}</td>
                      <td className="td text-right"><DeltaChip pct={r.percentageDifference} /></td>
                      <td className="td">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Active alerts</h3>
                <p className="text-xs text-slate-500">Latest {data.alerts?.length || 0} unresolved</p>
              </div>
              <Link to="/alerts" className="btn-ghost py-1.5 text-xs">All alerts</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data.alerts?.length === 0 && <EmptyState title="No active alerts" hint="All systems nominal." />}
              {data.alerts?.map((a) => (
                <Link key={a._id} to={`/alerts`} className="block px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <SeverityBadge severity={a.severity} />
                      <p className="min-w-0 truncate text-sm text-slate-700">
                        <span className="font-bold">{a.roomId?.roomNumber || '—'}</span> · {a.message}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{timeAgo(a.createdAt)}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ai/10 text-ai">
                <BrainCircuit size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">AI models</h3>
                <p className="text-xs text-slate-500">Forecasting engines</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-600">Energy model</span>
                <span className={`badge ${data.modelStatus?.energy ? 'bg-green-50 text-ok border border-green-200' : 'bg-red-50 text-danger border border-red-200'}`}>
                  {data.modelStatus?.energy ? 'READY' : 'UNAVAILABLE'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-600">Occupancy model</span>
                <span className={`badge ${data.modelStatus?.occupancy ? 'bg-green-50 text-ok border border-green-200' : 'bg-red-50 text-danger border border-red-200'}`}>
                  {data.modelStatus?.occupancy ? 'READY' : 'UNAVAILABLE'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-600">Simulation</span>
                <span className={`badge ${data.simulation?.running ? 'bg-green-50 text-ok border border-green-200' : 'bg-slate-100 text-slate-500'}`}>
                  {data.simulation?.running ? 'LIVE' : 'PAUSED'}
                </span>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-800">Top rooms today</h3>
            <div className="space-y-3">
              {topRooms.map((r, i) => (
                <div key={r.roomId} className="flex items-center gap-3">
                  <span className="w-5 text-center text-xs font-bold text-slate-400">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate font-semibold text-slate-700">{r.roomNumber}</span>
                      <span className="font-bold text-slate-700">{formatNumber(r.energy, 1)}</span>
                    </div>
                    <ProgressBar value={r.energy} max={topRooms[0]?.energy || 1} color="bg-ok" />
                  </div>
                </div>
              ))}
              {topRooms.length === 0 && <p className="text-xs text-slate-400">No readings yet — simulation still warming up.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}