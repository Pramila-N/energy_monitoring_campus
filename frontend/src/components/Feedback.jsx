import { Loader2 } from 'lucide-react';

export function Spinner({ size = 16, className = '' }) {
  return <Loader2 size={size} className={`spin text-brand-500 ${className}`} />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
      <Spinner size={28} />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <p className="text-sm font-semibold text-danger">Something went wrong</p>
      <p className="max-w-md text-sm text-slate-500">{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-1" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 py-14 text-center">
      <p className="text-sm font-semibold text-slate-500">{title || 'No data'}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}