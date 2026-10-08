import { useMemo, useState } from 'react';
import { BarChart3, Download, Building2, DoorOpen, Leaf, AlertTriangle, CalendarRange, CheckCircle2 } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { PageLoader, ErrorState, Spinner } from '../components/Feedback.jsx';
import { ChartCard, SimpleBars, CHART_COLORS } from '../components/charts.jsx';
import { formatNumber } from '../utils/format.js';

const TYPES = [
  { k: 'day', label: 'Today' },
  { k: 'week', label: 'Last 7 days' },
  { k: 'month', label: 'Last month' },
  { k: 'custom', label: 'Calendar range' }
];

function isoDate(d) {
  const x = new Date(d);
  const off = x.getTimezoneOffset();
  return new Date(x.getTime() - off * 60000).toISOString().slice(0, 10);
}

export default function Reports() {
  const toast = useToast();
  const [type, setType] = useState('day');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ type });
    if (type === 'custom') {
      if (from) params.set('from', from);
      if (to) params.set('to', to);
    }
    return params.toString();
  }, [type, from, to]);

  const { data, loading, error, refetch } = useApi(() => api.get(`/reports?${query}`).then((r) => r.data), [query]);

  const period = useMemo(() => (data?.period || []).map((p) => {
    let label = String(p.label || '');
    if (type === 'day') label = label.slice(11, 16);
    else if (type === 'custom') label = label.slice(0, 10);
    else label = label.slice(5);
    return { ...p, label };
  }), [data, type]);

  const rangeLabel = useMemo(() => {
    if (type !== 'custom' || !applied) return '';
    return `${applied.from || '…'} → ${applied.to || '…'}`;
  }, [type, applied]);

  const applyRange = () => {
    if (!from && !to) return;
    setApplied({ from, to });
    refetch();
  };

  const download = async () => {
    try {
      const res = await api.get(`/reports/export.csv?${query}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      const stamp = type === 'custom' ? `${from || 'from'}-${to || 'to'}` : type;
      a.download = `energy-report-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Report exported as CSV.');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to export CSV');
    }
  };

  if (loading && !data) return <PageLoader label="Building report…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const r = data;
  const subtitle = type === 'day'
    ? 'kWh per 30-min slot today'
    : type === 'week'
      ? 'kWh per day — last 7 days'
      : type === 'month'
        ? 'kWh per day — last month'
        : `kWh per day — ${rangeLabel}`;

  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="Energy Reports"
        subtitle="Aggregated consumption, savings and anomaly statistics"
        icon={BarChart3}
        actions={
          <>
            <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-slate-200">
              {TYPES.map((t) => (
                <button key={t.k} onClick={() => setType(t.k)} className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${type === t.k ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={download}>
              {loading ? <Spinner size={14} /> : <Download size={14} />} Export CSV
            </button>
          </>
        }
      />

      {type === 'custom' && (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
          </div>
          <button className="btn-primary" onClick={applyRange}>
            <CalendarRange size={14} /> Apply
          </button>
          <p className="ml-auto text-xs text-slate-400">Pick any two dates — the calendar lets you browse across years.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: 'Total energy', value: `${formatNumber(r.totalEnergy, 1)} kWh`, icon: BarChart3, color: 'text-brand-500 bg-brand-50', sub: `${formatNumber(r.readings, 0)} readings` },
          { label: 'Energy saved', value: `${formatNumber(r.energySaved, 1)} kWh`, icon: Leaf, color: 'text-ok bg-green-50', sub: 'vs appliance baseline' },
          { label: 'Anomalies', value: formatNumber(r.anomalies, 0), icon: AlertTriangle, color: 'text-danger bg-red-50', sub: 'abnormal predictions' },
          { label: 'Resolved alerts', value: formatNumber(r.resolvedAlerts, 0), icon: CheckCircle2, color: 'text-warn bg-amber-50', sub: 'in period' }
        ].map((c) => (
          <div key={c.label} className="card flex items-center gap-4 p-5">
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${c.color}`}><c.icon size={20} /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="text-xl font-bold text-slate-800">{c.value}</p>
              <p className="text-[11px] text-slate-400">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Consumption trend" subtitle={subtitle}>
          {period.length === 1 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
              {period[0].label} · {formatNumber(period[0].energy, 1)} kWh
            </div>
          ) : (
            <SimpleBars
              data={period}
              xKey="label"
              height={280}
              barKeys={[
                { key: 'energy', name: 'Consumption (kWh)', color: CHART_COLORS.energy },
                { key: 'sav', name: 'Saved (kWh)', color: CHART_COLORS.saved }
              ]}
            />
          )}
        </ChartCard>

        <ChartCard title="Consumption by building" subtitle={`${type === 'custom' ? rangeLabel : `Range: ${new Date(r.range?.from).toLocaleDateString()} → ${new Date(r.range?.to).toLocaleDateString()}`}`}>
          <SimpleBars
            data={(r.byBuilding || []).map((b) => ({ label: b.name.replace(' Building', ''), energy: b.energy }))}
            xKey="label"
            height={280}
            layout="vertical"
            barKeys={[{ key: 'energy', name: 'kWh', color: CHART_COLORS.energy }]}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Building2 size={16} className="text-brand-500" />
            <h3 className="text-sm font-bold text-slate-800">Room breakdown</h3>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 sticky top-0">
                <tr>
                  <th className="th">Room</th>
                  <th className="th">Type</th>
                  <th className="th text-right">Energy (kWh)</th>
                  <th className="th" style={{ width: 120 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {(r.byRoom || []).slice(0, 40).map((b) => (
                  <tr key={b.roomId} className="table-row">
                    <td className="td font-semibold">{b.roomNumber}</td>
                    <td className="td text-slate-500">{b.type.replaceAll('_', ' ')}</td>
                    <td className="td text-right font-bold">{formatNumber(b.energy, 1)}</td>
                    <td className="td">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-gradient-to-r from-brand-500 to-ai" style={{ width: `${Math.max(2, (b.energy / Math.max(r.totalEnergy, 0.001)) * 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <DoorOpen size={16} className="text-info" />
            <h3 className="text-sm font-bold text-slate-800">Period breakdown</h3>
          </div>
          <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500">{type === 'day' ? 'Hourly totals for today.' : type === 'custom' ? `Daily totals from ${rangeLabel || 'the selected range'}.` : type === 'week' ? 'Daily totals for the last 7 days.' : 'Daily totals across the last month.'}</p>
          <div className="max-h-[420px] overflow-y-auto">
            <div className="space-y-2 p-5">
              {(r.period || []).map((p) => (
                <div key={p.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-600">{p.label}</span>
                  <span className="flex items-center gap-4">
                    <span className="font-bold text-slate-800">{formatNumber(p.energy, 1)} kWh</span>
                    <span className="badge bg-green-50 text-ok border border-green-200">{formatNumber(p.sav, 2)} saved</span>
                  </span>
                </div>
              ))}
              {!r.period?.length && <p className="text-sm text-slate-400">No data in this window yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}