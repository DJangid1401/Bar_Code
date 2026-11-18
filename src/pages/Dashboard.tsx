import { useStore } from '../store';
import { ArrowDownToLine, ArrowUpFromLine, Package, Trash2 } from 'lucide-react';

export default function Dashboard() {
  const { items, logs, deleteLog } = useStore();

  const totalItems = items.length;
  const totalStock = items.reduce((acc, item) => acc + item.stock, 0);
  const totalIn = logs
    .filter(l => l.type === 'IN')
    .reduce((acc, l) => acc + (l.qty || 1), 0);
  const totalOut = logs
    .filter(l => l.type === 'OUT')
    .reduce((acc, l) => acc + (l.qty || 1), 0);

  const handleDeleteLog = (id: string, name: string) => {
    if (confirm(`Kya aap "${name}" ki transaction log delete karna chahte hain?`)) {
      deleteLog(id);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Inventory Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time stock summary and recent transaction logs.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Stock</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{totalStock}</p>
            <p className="text-xs text-slate-500 mt-1">Across all products</p>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl">
            <Package size={26} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unique Products</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{totalItems}</p>
            <p className="text-xs text-slate-500 mt-1">Distinct SKUs</p>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-3.5 rounded-xl">
            <Package size={26} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-green-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-green-600 uppercase tracking-wider">Total IN (Inward)</p>
            <p className="text-3xl font-extrabold text-green-700 mt-1">+{totalIn}</p>
            <p className="text-xs text-green-600/80 mt-1">Total units received</p>
          </div>
          <div className="bg-green-50 text-green-600 p-3.5 rounded-xl">
            <ArrowDownToLine size={26} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Total OUT (Dispatch)</p>
            <p className="text-3xl font-extrabold text-red-700 mt-1">-{totalOut}</p>
            <p className="text-xs text-red-600/80 mt-1">Total units dispatched</p>
          </div>
          <div className="bg-red-50 text-red-600 p-3.5 rounded-xl">
            <ArrowUpFromLine size={26} />
          </div>
        </div>
      </div>

      {/* Grid: Live Stock & Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Stock List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[520px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-base">Live Stock Status</h3>
            <span className="text-xs font-bold text-slate-400 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
              {items.length} Products
            </span>
          </div>
          <div className="p-4 flex-1 overflow-auto divide-y divide-slate-100">
            {items.map(item => (
              <div key={item.barcode} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-bold text-slate-800">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-mono">
                    <span>{item.barcode}</span>
                    {item.size && <span className="bg-slate-100 px-1.5 py-0.5 rounded font-sans">Size: {item.size}</span>}
                    {item.color && <span className="bg-slate-100 px-1.5 py-0.5 rounded font-sans">Color: {item.color}</span>}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full font-bold text-xs ${item.stock > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                  {item.stock} {item.unit || 'Pcs'}
                </span>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-slate-400 text-center py-20 text-sm">Abhi inventory mein koi item nahi hai.</p>
            )}
          </div>
        </div>

        {/* Recent IN / OUT Transaction Logs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[520px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-base">Recent Transactions</h3>
            <span className="text-xs font-bold text-slate-400 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
              {logs.length} Logs
            </span>
          </div>
          <div className="p-4 flex-1 overflow-auto divide-y divide-slate-100">
            {logs.map(log => (
              <div key={log.id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${log.type === 'IN' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {log.type === 'IN' ? <ArrowDownToLine size={20} /> : <ArrowUpFromLine size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{log.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="font-mono">{log.barcode}</span>
                      <span>•</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {log.source === 'EXCEL_IMPORT' && (
                        <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded text-[10px] font-bold">
                          Excel
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`font-bold text-sm ${log.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                    {log.type === 'IN' ? `+${log.qty || 1}` : `-${log.qty || 1}`} {log.unit || 'Pcs'}
                  </span>
                  <button
                    onClick={() => handleDeleteLog(log.id, log.name)}
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Delete this log"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-slate-400 text-center py-20 text-sm">Abhi koi scan ya inward history nahi hai.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
