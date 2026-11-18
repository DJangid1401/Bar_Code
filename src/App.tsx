import { useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity as ActivityIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  RefreshCw,
  AlertTriangle,
  Users as UsersIcon,
  LogOut,
  UserCircle2,
} from 'lucide-react';
import { useStore } from './store';
import Dashboard from './pages/Dashboard';
import Activity from './pages/Activity';
import In from './pages/In';
import Out from './pages/Out';
import Stock from './pages/Stock';
import Users from './pages/Users';
import Login from './pages/Login';

function Sidebar() {
  const location = useLocation();
  const {
    currentUser,
    isLoading,
    isSyncing,
    lastSyncedAt,
    fetchData,
    logout,
  } = useStore();

  const links = [
    { path: '/', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/activity', name: 'Activity', icon: ActivityIcon },
    { path: '/in', name: 'Stock IN', icon: ArrowDownToLine },
    { path: '/out', name: 'Stock OUT', icon: ArrowUpFromLine },
    { path: '/stock', name: 'Stock List & QR', icon: Package },
    ...(currentUser?.role === 'Admin'
      ? [{ path: '/users', name: 'Users & Login', icon: UsersIcon }]
      : []),
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-xl z-20">
      <div className="p-6 text-2xl font-bold border-b border-slate-800">
        Swati Entreprise
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-2 mt-4 overflow-y-auto">
        {links.map(l => {
          const active = location.pathname === l.path;
          return (
            <Link
              key={l.path}
              to={l.path}
              className={`flex items-center gap-3 p-3 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-blue-600 text-white font-semibold shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <l.icon size={20} />
              <span>{l.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Signed-in User & Sync Controls Footer (No Google Sheet icon) */}
      <div className="p-4 border-t border-slate-800 space-y-2.5">
        {currentUser && (
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
            <UserCircle2 size={22} className="text-blue-400 shrink-0" />
            <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
          </div>
        )}

        {lastSyncedAt && (
          <p className="text-[10px] text-slate-400 text-center">
            Updated:{' '}
            {new Date(lastSyncedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => fetchData(false)}
            disabled={isLoading || isSyncing}
            className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold py-2 px-2.5 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw
              size={13}
              className={isLoading || isSyncing ? 'animate-spin' : ''}
            />
            <span>{isLoading ? 'Syncing' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center gap-1.5 bg-red-950/60 hover:bg-red-900/70 border border-red-800/60 text-red-200 text-xs font-semibold py-2 px-2.5 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  const { currentUser, fetchData, startAutoSync, error, clearError } = useStore();

  useEffect(() => {
    if (!currentUser) return;
    fetchData(false);
    const stopSync = startAutoSync(15000);
    return () => {
      stopSync();
    };
  }, [currentUser, fetchData, startAutoSync]);

  if (!currentUser) {
    return <Login />;
  }

  return (
    <HashRouter>
      <div className="flex bg-slate-50 min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 overflow-auto h-screen">
          {/* Sync Error Banner */}
          {error && (
            <div className="mb-6 bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={22}
                  className="text-amber-600 shrink-0 mt-0.5"
                />
                <div className="text-sm text-amber-900 space-y-1">
                  <p className="font-bold">Sync Notice</p>
                  <p className="text-xs text-amber-800 leading-relaxed">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearError}
                className="text-xs font-bold text-amber-800 hover:underline shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/in" element={<In />} />
            <Route path="/out" element={<Out />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/users" element={<Users />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
