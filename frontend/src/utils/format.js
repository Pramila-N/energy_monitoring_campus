export function formatNumber(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function formatKwh(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(digits)} kWh`;
}

export function formatPct(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(digits)}%`;
}

export function formatDuration(min) {
  if (!min) return '0m';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function formatClock(value) {
  if (value === null || value === undefined) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(value);
  }
}

export function formatTimeStamp(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(value);
  }
}

export function timeAgo(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function statusOf(pct) {
  const abs = Math.abs(Number(pct) || 0);
  if (abs > 20) return 'abnormal';
  if (abs > 10) return 'warning';
  return 'normal';
}

export function statusColor(status) {
  switch (status) {
    case 'abnormal':
      return 'text-danger bg-red-50 border border-red-200';
    case 'warning':
      return 'text-warn bg-amber-50 border border-amber-200';
    case 'normal':
      return 'text-ok bg-green-50 border border-green-200';
    case 'critical':
      return 'text-danger bg-red-50 border border-red-200';
    default:
      return 'text-slate-600 bg-slate-100 border border-slate-200';
  }
}

export function severityColor(severity) {
  switch (severity) {
    case 'critical':
      return 'text-danger bg-red-50 border border-red-200';
    case 'high':
      return 'text-orange-600 bg-orange-50 border border-orange-200';
    case 'medium':
      return 'text-warn bg-amber-50 border border-amber-200';
    case 'low':
      return 'text-info bg-sky-50 border border-sky-200';
    default:
      return 'text-slate-600 bg-slate-100 border border-slate-200';
  }
}

export function roomTypeLabel(t) {
  const map = {
    classroom: 'Classroom',
    computer_lab: 'Computer Lab',
    physics_lab: 'Physics Lab',
    chemistry_lab: 'Chemistry Lab',
    electronics_lab: 'Electronics Lab',
    seminar_hall: 'Seminar Hall',
    staff_room: 'Staff Room',
    lecture: 'Lecture Hall',
    lab: 'Laboratory'
  };
  return map[t] || t.replaceAll('_', ' ');
}

export function alertTypeLabel(t) {
  const map = {
    EXCESS_ENERGY: 'Excess Energy',
    EMPTY_ROOM_APPLIANCES: 'Empty Room · Appliances ON',
    HIGH_CONSUMPTION: 'High Consumption',
    SYSTEM_WARNING: 'System Warning'
  };
  return map[t] || t.replaceAll('_', ' ');
}

export function recommendationTypeLabel(t) {
  const map = {
    ADVICE: 'Advice',
    OPTIMIZATION: 'Optimization',
    INTERVENTION: 'Intervention',
    EMPTY_ROOM_APPLIANCES: 'Empty Room · Appliances ON',
    EXCESS_ENERGY: 'Excess Energy',
    LOW_OCCUPANCY_HIGH_ENERGY: 'Low Occupancy · High Energy',
    INFO: 'Info'
  };
  return map[t] || t.replaceAll('_', ' ');
}

export const PERIOD_LABELS = {
  1: '08:00–09:50',
  2: '10:00–11:50',
  3: '12:00–13:50',
  4: '14:00–15:50',
  5: '16:00–17:50',
  6: '18:00–19:50',
  7: '20:00–21:50',
  8: '22:00–23:50'
};

export function periodLabel(p) {
  return PERIOD_LABELS[p] || '';
}