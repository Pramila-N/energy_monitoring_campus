import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function AdminLayout() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const onUnauthorized = () => navigate('/login', { replace: true });
    window.addEventListener('sma:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sma:unauthorized', onUnauthorized);
  }, [navigate]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <Sidebar onNavigate={() => setMenuOpen(false)} />
      <div className={`fixed inset-0 z-30 bg-slate-900/40 lg:hidden ${menuOpen ? 'block' : 'hidden'}`} onClick={() => setMenuOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenu={() => setMenuOpen(true)} refreshTick={refreshTick} />
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <div key={refreshTick} className="contents">
            <Outlet context={{ bump: () => setRefreshTick((t) => t + 1) }} />
          </div>
        </main>
      </div>
    </div>
  );
}