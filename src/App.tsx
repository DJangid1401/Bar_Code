import { useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  FileSpreadsheet,
  CloudOff,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from './store';
import Dashboard from './pages/Dashboard';
import In from './pages/In';
import Out from './pages/Out';
import Stock from './pages/Stock';

function Sidebar() {
  const location = useLocation();
  const {
    isConfigured,
    isLoading,
    isSyncing,
    lastSyncedAt,
    fetchData,
  } = useStore();

  const links = [
    { path: '/', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/in', name: 'Stock IN', icon: ArrowDownToLine },
    { path: '/out', name: 'Stock OUT', icon: ArrowUpFromLine },
    { path: '/stock', name: 'Stock List & QR', icon: Package },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-xl z-20">
      <div className="p-6 text-2xl font-bold border-b border-slate-800">
        QR Inventory
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

      {/* Google Sheets Sync Footer */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        <div
          className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg ${
            isConfigured
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
              : 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
          }`}
        >
          {isConfigured ? (
            <FileSpreadsheet size={15} className="shrink-0 text-emerald-400" />
          ) : (
            <CloudOff size={15} className="shrink-0 text-amber-400" />
          )}
          <span className="truncate">
            {isConfigured
              ? isSyncing
                ? 'Syncing Sheet...'
                : 'Google Sheet Live'
              : 'Sheet URL Not Set'}
          </span>
        </div>

        {lastSyncedAt && (
          <p className="text-[10px] text-slate-400 text-center">
            Last synced:{' '}
            {new Date(lastSyncedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
        )}

        <button
          type="button"
          onClick={() => fetchData(false)}
          disabled={isLoading || isSyncing || !isConfigured}
          className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold py-2 px-3 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw
            size={14}
            className={isLoading || isSyncing ? 'animate-spin' : ''}
          />
          <span>{isLoading ? 'Syncing...' : 'Sync Sheet Now'}</span>
        </button>
      </div>
    </aside>
  );
}

export default function App() {
  const { fetchData, startAutoSync, error, isConfigured, clearError } = useStore();

  useEffect(() => {
    fetchData(false);
    const stopSync = startAutoSync(15000);
    return () => {
      stopSync();
    };
  }, [fetchData, startAutoSync]);

  return (
    <HashRouter>
      <div className="flex bg-slate-50 min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 overflow-auto h-screen">
          {/* Google Sheets Configuration / Sync Error Banner */}
          {(!isConfigured || error) && (
            <div className="mb-6 bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={22}
                  className="text-amber-600 shrink-0 mt-0.5"
                />
                <div className="text-sm text-amber-900 space-y-1">
                  <p className="font-bold">
                    {!isConfigured
                      ? 'Google Sheets Setup Pending'
                      : 'Google Sheets Sync Error'}
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {error ||
                      'Please deploy google_apps_script.gs as a Web App and paste the URL into .env.local as VITE_GOOGLE_SHEET_URL.'}
                  </p>
                </div>
              </div>
              {isConfigured && error && (
                <button
                  type="button"
                  onClick={clearError}
                  className="text-xs font-bold text-amber-800 hover:underline shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/in" element={<In />} />
            <Route path="/out" element={<Out />} />
            <Route path="/stock" element={<Stock />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
