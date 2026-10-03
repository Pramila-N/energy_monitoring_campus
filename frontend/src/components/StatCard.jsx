export function StatCard({ label, value, sub, icon: Icon, accent = 'brand', loading }) {
  const accents = {
    brand: 'bg-brand-500',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
    info: 'bg-info',
    ai: 'bg-ai'
  };
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white ${accents[accent]}`}>
        {Icon && <Icon size={20} />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-6 w-20 animate-pulse rounded bg-slate-200" />
        ) : (
          <p className="truncate text-xl font-bold text-slate-800">{value}</p>
        )}
        {sub && !loading && <p className="truncate text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}