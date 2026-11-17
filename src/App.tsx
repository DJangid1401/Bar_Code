import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, Package } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import In from './pages/In';
import Out from './pages/Out';
import Stock from './pages/Stock';

function Sidebar() {
  const location = useLocation();
  const links = [
    { path: '/', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/in', name: 'Stock IN', icon: ArrowDownToLine },
    { path: '/out', name: 'Stock OUT', icon: ArrowUpFromLine },
    { path: '/stock', name: 'Stock List', icon: Package }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-xl">
      <div className="p-6 text-2xl font-bold border-b border-slate-800">QR Inventory</div>
      <nav className="flex-1 p-4 space-y-2 mt-4">
        {links.map(l => {
          const active = location.pathname === l.path;
          return (
            <Link key={l.path} to={l.path} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${active ? 'bg-blue-600 text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <l.icon size={20} />
              {l.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div className="flex bg-slate-50 min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 overflow-auto h-screen">
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