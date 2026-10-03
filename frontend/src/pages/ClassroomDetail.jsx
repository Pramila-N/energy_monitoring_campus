import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Lightbulb,
  Fan,
  BrainCircuit,
  Phone,
  Bell,
  Activity,
  Thermometer,
  Copy,
  CircleDollarSign,
  TrendingUp
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { usePolling } from '../hooks/useApi.js';
import api from '../api/client.js';
import { PageLoader, ErrorState } from '../components/Feedback.jsx';
import { StatusBadge, OnOffBadge, SeverityBadge, RecTypeTag } from '../components/Badges.jsx';
import { ConsumptionArea, TrendLines, ChartCard, CHART_COLORS } from '../components/charts.jsx';
import { ContactFacultyModal } from '../components/ContactFacultyModal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatKwh, formatPct, formatNumber, timeAgo, roomTypeLabel } from '../utils/format.js';

const PERIOD_MODEL_AVG = 3.0;

export default function ClassroomDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [contactOpen, setContactOpen] = useState(false);
  const [alert, setAlert] = useState(null);

  const room = usePolling(() => api.get(`/classrooms/${id}`).then((r) => r.data), 60000);
  const alerts = usePolling(() => api.get(`/alerts?roomId=${id}`).then((r) => r.data.alerts), 60000);
  const recs = usePolling(() => api.get(`/recommendations?roomId=${id}&status=active`).then((r) => r.data.recommendations), 60000);

  if (room.loading) return <PageLoader label="Loading classroom…" />;
  if (room.error) return <ErrorState message={room.error} onRetry={room.refetch} />;

  const c = room.data.classroom;
  const series = room.data.series || [];
  const hourly = room.data.hourly || [];
  const pct = Number(c.percentageDifference) || 0;
  const abnormal = Math.abs(pct) > 20;
  const pctColor = abnormal ? 'text-danger' : Math.abs(pct) > 10 ? 'text-warn' : 'text-ok';

  const chartData = series.map((pt) => ({
    label: new Date(pt.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    actual: Number(pt.energy.toFixed(3)),
    predicted: Number((c.predictedEnergy || 0).toFixed(3)),
    occupancy: pt.occupancy
  }));

  const avg = chartData.reduce((s, pt) => s + pt.actual, 0) / Math.max(chartData.length, 1);
  const savings = Math.max(0, PERIOD_MODEL_AVG - avg) * 12;
  const forecastCost = (c.predictedEnergy || 0) * 0.12;

  const handleContact = useCallback(
    async (note) => {
      try {
        await api.post(`/alerts/${alert._id}/contact`);
        toast.success('Faculty notified (simulated) — alert marked as contacted.');
        setContactOpen(false);
      } catch (e) {
        toast.error(e?.response?.data?.message || 'Failed to notify faculty');
      }
    },
    [alert, toast]
  );

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(`Room ${c.roomNumber} | ${formatKwh(c.currentEnergy, 2)} actual vs ${formatKwh(c.predictedEnergy, 2)} predicted (${formatPct(pct)})`);
      toast.success('Room summary copied to clipboard.');
    } catch {
      toast.info('Clipboard unavailable.');
    }
  };

  const onCallFaculty = (a) => {
    setAlert(a);
    setContactOpen(true);
  };

  return (
    <div className="fade-in space-y-6">
      <Link to="/campus" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
        <ArrowLeft size={15} /> Buildings & Classrooms
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
              <Users size={26} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-800">{c.roomNumber}</h1>
                <StatusBadge status={c.status} />
                {c.scenario && <span className="badge bg-ai/10 text-ai border border-ai/20">Demo scenario</span>}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {c.name || c.buildingId?.name} · {c.buildingId?.code} · Floor {c.floor} · {roomTypeLabel(c.type)} · capacity {c.capacity}
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm">
                {c.facultyId ? (
                  <>
                    <span className="font-semibold text-slate-700">{c.facultyId.name}</span>
                    <span className="text-slate-400">{c.facultyId.department}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      <Phone size={11} /> {c.facultyId.phoneNumber}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400">Unassigned faculty</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gauge strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className={`rounded-xl border p-4 ${abnormal ? 'border-red-200 bg-red-50' : Math.abs(pct) > 10 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="inline-flex items-center gap-1"><Activity size={13} /> AI prediction</span>
              <BrainCircuit size={15} className="text-ai" />
            </div>
            <p className="mt-2 text-2xl font-extrabold">{formatKwh(c.predictedEnergy, 2)} <span className="text-xs font-semibold text-slate-400">kWh / 30 min</span></p>
            <p className={`mt-1 text-sm font-bold ${pctColor}`}>
              {pct > 0 ? '+' : ''}{formatPct(pct)} vs actual
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="inline-flex items-center gap-1"><Users size={13} /> Occupancy</span>
              <span className="text-slate-400">{c.expectedOccupancy > 0 ? 'expected' : ''}</span>
            </div>
            <p className="mt-2 text-2xl font-extrabold">
              {c.currentOccupancy} <span className="text-base font-bold text-slate-400">/ {c.capacity}</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {c.presenceDetected ? <span className="font-bold text-ok">Presence detected</span> : 'No presence'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="inline-flex items-center gap-1"><Lightbulb size={13} /> Appliances</span>
              <span className="flex gap-1"><Lightbulb size={13} className={c.lightStatus === 'on' ? 'text-warn' : 'text-slate-300'} /><Fan size={13} className={c.fanStatus === 'on' ? 'text-info' : 'text-slate-300'} /></span>
            </div>
            <p className="mt-2 text-2xl font-extrabold">
              <span className={c.lightStatus === 'on' ? 'text-warn' : 'text-slate-400'}>L{`${c.numLights}`}</span> <span className="text-slate-300">·</span> <span className={c.fanStatus === 'on' ? 'text-info' : 'text-slate-400'}>F{`${c.numFans}`}</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {c.hasAC ? <span className="inline-flex items-center gap-1 font-semibold text-sky-600"><Thermometer size={12} /> AC unit</span> : 'No AC installed'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <CircleDollarSign size={13} /> Estimated bill impact
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-800">≈ ${forecastCost.toFixed(2)}</p>
            <p className="mt-1 text-sm text-slate-500">per 30 min @ $0.12/kWh</p>
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => { const a = alerts.data?.find((x) => x.status !== 'resolved'); if (a) onCallFaculty(a); else toast.info('No active alert for this room to notify.'); }}>
          <Phone size={15} /> Contact faculty
        </button>
        <button className="btn-secondary" onClick={copyRoom}>
          <Copy size={15} /> Copy summary
        </button>
        <span className="ml-auto text-xs font-medium text-slate-400">Last updated {timeAgo(c.updatedAt)}</span>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard
            title="Actual vs AI-predicted consumption"
            subtitle="Latest meter readings (kWh per 30-min slot) against the model forecast"
          >
            <ConsumptionArea
              data={chartData}
              xKey="label"
              height={280}
              series={[
                { key: 'actual', name: 'Actual (kWh)', color: CHART_COLORS.energy },
                { key: 'predicted', name: 'AI predicted (kWh)', color: CHART_COLORS.predicted }
              ]}
            />
          </ChartCard>
        </div>
        <ChartCard title="Occupancy trend" subtitle="Simulated presence sensor readings">
          <TrendLines
            data={chartData}
            xKey="label"
            height={280}
            series={[{ key: 'occupancy', name: 'Occupants', color: CHART_COLORS.occupancy }]}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bell size={16} className="text-danger" />
            <h3 className="text-sm font-bold text-slate-800">Room alerts</h3>
          </div>
          <div className="space-y-2">
            {(alerts.data || []).length === 0 && <p className="text-sm text-slate-400">No alerts for this room.</p>}
            {(alerts.data || []).slice(0, 5).map((a) => (
              <div key={a._id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={a.severity} />
                    <span className="text-xs font-bold uppercase text-slate-500">{a.type.replaceAll('_', ' ')}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-700">{a.message}</p>
                  <p className="text-[11px] text-slate-400">{timeAgo(a.createdAt)} · {a.status}</p>
                </div>
                {a.status !== 'resolved' && (
                  <button className="btn-secondary py-1.5 text-xs" onClick={() => onCallFaculty(a)}>
                    <Phone size={12} /> Contact
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb size={16} className="text-warn" />
            <h3 className="text-sm font-bold text-slate-800">Active optimization recommendations</h3>
          </div>
          <div className="space-y-2">
            {(recs.data || []).length === 0 && <p className="text-sm text-slate-400">No active recommendations.</p>}
            {(recs.data || []).slice(0, 5).map((r) => (
              <div key={r._id} className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <RecTypeTag type={r.type} />
                  <span className={`badge ${r.priority === 'high' ? 'bg-red-50 text-danger border border-red-200' : r.priority === 'medium' ? 'bg-amber-50 text-warn border border-amber-200' : 'bg-sky-50 text-info border border-sky-200'}`}>
                    {r.priority}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-slate-700">{r.message}</p>
                <p className="mt-1 text-xs text-slate-500">{r.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Aggregates */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <TrendingUp size={16} className="text-brand-500" /> Energy intensity
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-800">{Number(avg.toFixed(3))} <span className="text-xs font-semibold text-slate-400">avg kWh/slot</span></p>
          <p className="mt-1 text-xs text-slate-500">model baseline ≈ 1.0–2.5 kWh</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <CircleDollarSign size={16} className="text-ok" /> Modelled savings
          </div>
          <p className="mt-2 text-2xl font-extrabold text-green-600">≈ {formatNumber(savings, 1)} kWh/day</p>
          <p className="mt-1 text-xs text-slate-500">if consumption returns to model baseline</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <BrainCircuit size={16} className="text-ai" /> Forecast features
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Current occupancy {formatNumber(c.currentOccupancy, 0)} · {roomTypeLabel(c.type)} baseline
          </p>
          <p className="mt-1 text-xs text-slate-400">features: occupancy, timetable, historical rate, time-of-day</p>
        </div>
      </div>

      <ContactFacultyModal open={contactOpen} onClose={() => setContactOpen(false)} room={c} alert={alert} onSubmit={handleContact} />
    </div>
  );
}