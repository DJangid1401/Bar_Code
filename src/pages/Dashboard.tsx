import { useStore } from '../store';
import { ArrowDownToLine, ArrowUpFromLine, Package } from 'lucide-react';

export default function Dashboard() {
  const { items, logs } = useStore();

  const totalItems = items.length;
  const totalStock = items.reduce((acc, item) => acc + item.stock, 0);
  const totalIn = logs.filter(l => l.type === 'IN').length;
  const totalOut = logs.filter(l => l.type === 'OUT').length;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3 text-blue-600 mb-2"><Package /> <h3 className="font-semibold">Total Stock</h3></div>
          <p className="text-4xl font-bold">{totalStock}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3 text-slate-600 mb-2"><h3 className="font-semibold">Unique Items</h3></div>
          <p className="text-4xl font-bold">{totalItems}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm border-green-200">
          <div className="flex items-center gap-3 text-green-600 mb-2"><ArrowDownToLine /> <h3 className="font-semibold">Total IN Today</h3></div>
          <p className="text-4xl font-bold text-green-700">{totalIn}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm border-red-200">
          <div className="flex items-center gap-3 text-red-600 mb-2"><ArrowUpFromLine /> <h3 className="font-semibold">Total OUT Today</h3></div>
          <p className="text-4xl font-bold text-red-700">{totalOut}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b bg-slate-50"><h3 className="font-bold text-lg">Live Stock List</h3></div>
          <div className="p-4 flex-1 overflow-auto">
            {items.map(item => (
              <div key={item.barcode} className="flex justify-between items-center py-3 border-b last:border-0">
                <div>
                  <p className="font-bold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{item.barcode}</p>
                </div>
                <span className="bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full font-bold text-sm">Stock: {item.stock}</span>
              </div>
            ))}
            {items.length === 0 && <p className="text-slate-400 text-center mt-10">No items in stock.</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b bg-slate-50"><h3 className="font-bold text-lg">Recent IN / OUT Logs</h3></div>
          <div className="p-4 flex-1 overflow-auto">
            {logs.map(log => (
              <div key={log.id} className="flex justify-between items-center py-3 border-b last:border-0">
                <div className="flex items-center gap-3">
                  {log.type === 'IN' ? <ArrowDownToLine className="text-green-500 bg-green-50 p-2 rounded-full" size={32} /> : <ArrowUpFromLine className="text-red-500 bg-red-50 p-2 rounded-full" size={32} />}
                  <div>
                    <p className="font-semibold text-slate-800">{log.name}</p>
                    <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <span className={`font-bold text-lg ${log.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                  {log.type === 'IN' ? '+1 IN' : '-1 OUT'}
                </span>
              </div>
            ))}
            {logs.length === 0 && <p className="text-slate-400 text-center mt-10">No scan history yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}