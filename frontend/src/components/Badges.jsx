import { statusColor, severityColor, alertTypeLabel, roomTypeLabel, recommendationTypeLabel } from '../utils/format.js';

export function StatusBadge({ status, children }) {
  const label = children || (status ? status[0].toUpperCase() + status.slice(1) : status);
  return <span className={`badge ${statusColor(status)}`}>{label}</span>;
}

export function SeverityBadge({ severity }) {
  return <span className={`badge ${severityColor(severity)}`}>{severity}</span>;
}

export function AlertTypeTag({ type }) {
  return <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200">{alertTypeLabel(type)}</span>;
}

export function RoomTypeTag({ type }) {
  return <span className="badge bg-slate-100 text-slate-600">{roomTypeLabel(type)}</span>;
}

export function RecTypeTag({ type }) {
  return <span className="badge bg-violet-50 text-violet-700 border border-violet-200">{recommendationTypeLabel(type)}</span>;
}

export function RoomStatusCard({ status }) {
  return <StatusBadge status={status} />;
}

export function OnOffBadge({ value }) {
  return value ? (
    <span className="badge bg-green-50 text-ok border border-green-200">ON</span>
  ) : (
    <span className="badge bg-slate-100 text-slate-500 border border-slate-200">OFF</span>
  );
}