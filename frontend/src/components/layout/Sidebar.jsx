import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  BrainCircuit,
  Bell,
  BarChart3,
  LogOut,
  Cpu,
  ZapOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/campus', label: 'Buildings & Classrooms', icon: Building2 },
  { to: '/predictions', label: 'Predictions', icon: BrainCircuit },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/reports', label: 'Reports', icon: BarChart3 }
];

export function Sidebar({ onNavigate }) {
  const { admin, logout } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-ai text-white">
          <ZapOff size={20} />
        </div>
        <div>
          <p className="text-sm font-extrabold text-white">Smart Energy AI</p>
          <p className="text-[11px] font-medium text-slate-400">Campus Monitoring Suite</p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-600/20 text-white ring-1 ring-brand-500/40' : 'hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 px-3 py-4">
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ai/30 text-[13px] font-bold text-white">
            {admin?.name ? admin.name[0].toUpperCase() : 'A'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{admin?.name || 'Admin'}</p>
            <p className="truncate text-[11px] text-slate-400">{admin?.email}</p>
          </div>
        </div>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-800 hover:text-white">
          <LogOut size={17} />
          Sign out
        </button>
        <div className="mt-3 flex items-center gap-2 px-3 text-[11px] text-slate-500">
          <Cpu size={12} className="text-ai" />
          AI-assisted operations
        </div>
      </div>
    </aside>
  );
}