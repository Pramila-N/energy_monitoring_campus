import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Menu, Clock, Activity } from 'lucide-react';
import api from '../../api/client.js';
import { formatClock } from '../../utils/format.js';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function Topbar({ onMenu, refreshTick }) {
  const [sim, setSim] = useState(null);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/dashboard/summary');
        setAlertCount(res.data.alerts?.length || 0);
      } catch {
        /* ignore */
      }
    };
    load();
  }, [refreshTick]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/simulation/status');
        setSim(data);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [refreshTick]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
        <Menu size={19} />
      </button>

      <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
        <Clock size={14} className="text-brand-500" />
        <span>Sim time</span>
        <span className="font-bold text-slate-800">{formatClock(sim?.simClock)}</span>
        <span className="hidden text-slate-400 sm:inline">{DAY_LABELS[sim?.simDay ?? 0]}</span>
      </div>

      <div className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-600">
        <span className="hidden items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 sm:flex">
          <Activity size={14} className="text-brand-500" />
          {sim?.minutesPerTick} min/tick
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${sim?.running ? 'bg-green-50 text-ok' : 'bg-slate-100 text-slate-500'}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${sim?.running ? 'bg-green-500 pulse-dot' : 'bg-slate-400'}`} />
          {sim?.running ? 'LIVE' : 'PAUSED'}
        </span>
        <Link to="/alerts" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
          <Bell size={18} />
          {alertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {alertCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}