import { useMemo, useState } from 'react';
import { BrainCircuit, RefreshCw, Target, Scale, Gauge, Cpu } from 'lucide-react';
import { usePolling } from '../hooks/useApi.js';
import api from '../api/client.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { PageLoader, ErrorState, EmptyState, Spinner } from '../components/Feedback.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import { ChartCard, SimpleBars, CHART_COLORS } from '../components/charts.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatNumber, formatPct, formatTimeStamp, formatKwh } from '../utils/format.js';

function Metric({ label, value, sub, icon: Icon, className = 'text-brand-500 bg-brand-50' }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${className}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="truncate text-xl font-bold text-slate-800">{value}</p>
        {sub && <p className="truncate text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

export default function Predictions() {
  const toast = useToast();
  const [generating, setGenerating] = useState(false);
  const metrics = usePolling(() => api.get('/predictions/metrics').then((r) => r.data), 60000);
  const preds = usePolling(() => api.get('/predictions?limit=80').then((r) => r.data.predictions), 60000);

  const chartData = useMemo(() => {
    if (!preds.data?.length) return [];
    const map = new Map();
    preds.data.forEach((p) => {
      const key = p.roomId?.roomNumber || '?';
      if (!map.has(key)) map.set(key, { label: key, predicted: Number((p.predictedEnergy || 0).toFixed(2)), actual: Number((p.actualEnergy || 0).toFixed(2)) });
    });
    return [...map.values()].slice(0, 14);
  }, [preds.data]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/predictions/generate');
      toast.success(data.message || 'Predictions regenerated.');
      preds.refetch();
      metrics.refetch();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to generate predictions');
    } finally {
      setGenerating(false);
    }
  };

  if (metrics.loading && !metrics.data) return <PageLoader label="Loading AI model metrics…" />;
  if (metrics.error) return <ErrorState message={metrics.error} onRetry={metrics.refetch} />;

  const em = metrics.data?.energy?.metrics || {};
  const om = metrics.data?.occupancy?.metrics || {};
  const norm = metrics.data?.energy?.normalization || {};
  const modelName = metrics.data?.energy?.model || 'sklearn model';
  const split = metrics.data?.energy?.split || {};

  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="AI Predictions"
        subtitle="Machine-learning forecasts against actual consumption"
        icon={BrainCircuit}
        actions={
          <button className="btn-primary" onClick={generate} disabled={generating}>
            {generating ? <Spinner size={15} className="text-white" /> : <RefreshCw size={15} />}
            {generating ? 'Generating…' : 'Generate now'}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Metric label="Energy R²" value={formatNumber(em.r2, 3)} sub={`${modelName} · held-out test week`} icon={Target} />
        <Metric label="Energy MAE" value={formatNumber(em.mae, 4)} sub="kWh avg error on unseen data" icon={Scale} />
        <Metric label="Energy RMSE" value={formatNumber(em.rmse, 3)} sub="kWh root mean square error" icon={Gauge} />
        <Metric label="Energy MAPE" value={formatPct(em.mape, 2)} sub={`mean abs % error (test rows ${formatNumber(split.test_rows, 0)})`} icon={Cpu} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard title="Predicted vs actual (recent)" subtitle="Latest forecast pass per room — bars compare AI expectation against meters">
            <SimpleBars
              data={chartData}
              xKey="label"
              height={300}
              barKeys={[
                { key: 'predicted', name: 'AI predicted', color: CHART_COLORS.predicted },
                { key: 'actual', name: 'Actual', color: CHART_COLORS.energy }
              ]}
            />
          </ChartCard>
        </div>

        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Recent predictions</h3>
                <p className="text-xs text-slate-500">{preds.data?.length || 0} latest</p>
              </div>
            </div>
            <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
              {(preds.data || []).length === 0 && <div className="p-6"><EmptyState title="No predictions yet" /></div>}
              {(preds.data || []).slice(0, 30).map((p) => (
                <div key={p._id} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700">{p.roomId?.roomNumber || '—'}</p>
                    <p className="truncate text-[11px] text-slate-400">{formatTimeStamp(p.timestamp)} · conf {formatNumber(p.confidence * 100, 0)}% · v{p.modelVersion}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-violet-600">≈{formatKwh(p.predictedEnergy, 2)}</span>
                    <span className="text-slate-400">↦</span>
                    <span className="text-brand-600">{formatKwh(p.actualEnergy, 2)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-800">Pipeline</h3>
            <ol className="mt-3 space-y-2.5 text-sm text-slate-600">
              {[
                'Meter telemetry + occupancy snapshots collected each tick (live process, not hardcoded)',
                'Features: people count, timetable, historical rate, time-of-day pushed to the Python scikit-learn server',
                'Model trained on ~2 months, verified on a held-out final week — forecasts kWh per room per 30-min slot',
                'Deviation > thresholds → alerts + recommendations'
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ai/10 text-[11px] font-bold text-ai">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}