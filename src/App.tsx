import { useEffect, useState } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBag,
  Contact2,
} from 'lucide-react';
import { useStore } from './store';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Customers from './pages/Customers';
import Activity from './pages/Activity';
import In from './pages/In';
import Out from './pages/Out';
import Stock from './pages/Stock';
import Users from './pages/Users';
import Login from './pages/Login';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
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
    { path: '/sales', name: 'Full Sales', icon: ShoppingBag },
    { path: '/customers', name: 'Customer DB', icon: Contact2 },
    { path: '/activity', name: 'Activity', icon: ActivityIcon },
    { path: '/in', name: 'Stock IN', icon: ArrowDownToLine },
    { path: '/out', name: 'Stock OUT', icon: ArrowUpFromLine },
    { path: '/stock', name: 'Stock List & QR', icon: Package },
    ...(currentUser?.role === 'Admin'
      ? [{ path: '/users', name: 'Users & Login', icon: UsersIcon }]
      : []),
  ];

  const handleNavClick = () => {
    // Auto-collapse sidebar on mobile/tablet after choosing a page
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile / tablet backdrop overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px] z-20 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-xl z-30 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between gap-2">
          <span className="text-xl font-bold tracking-tight truncate">
            Swati Entreprise
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Hide Sidebar"
            aria-label="Hide Sidebar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <PanelLeftClose size={20} />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 p-4 space-y-2 mt-2 overflow-y-auto">
          {links.map(l => {
            const active = location.pathname === l.path;
            return (
              <Link
                key={l.path}
                to={l.path}
                onClick={handleNavClick}
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
    </>
  );
}

export default function App() {
  const { currentUser, fetchData, startAutoSync, error, clearError } = useStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    if (!currentUser) return;
    fetchData(false);
    const stopSync = startAutoSync(15000);
    return () => {
      stopSync();
    };
  }, [currentUser, fetchData, startAutoSync]);

  // Trigger resize after sidebar transition so Recharts charts smoothly expand/shrink
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 320);
    return () => window.clearTimeout(timer);
  }, [isSidebarOpen]);

  if (!currentUser) {
    return <Login />;
  }

  return (
    <HashRouter>
      <div className="flex bg-slate-50 min-h-screen">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main
          className={`flex-1 p-4 sm:p-6 lg:p-8 overflow-auto h-screen transition-all duration-300 ease-in-out ${
            isSidebarOpen ? 'lg:ml-64' : 'ml-0'
          }`}
        >
          {/* Open Sidebar Trigger when collapsed */}
          {!isSidebarOpen && (
            <div className="mb-4 flex items-center">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                title="Show Sidebar"
                aria-label="Show Sidebar"
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <PanelLeftOpen size={16} />
                <span>Menu</span>
                <span className="text-slate-400 font-medium hidden sm:inline">
                  • Swati Entreprise
                </span>
              </button>
            </div>
          )}

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
            <Route path="/sales" element={<Sales />} />
            <Route path="/customers" element={<Customers />} />
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
