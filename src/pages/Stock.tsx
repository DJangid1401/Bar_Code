import { useState } from 'react';
import { useStore } from '../store';
import { Package, Search } from 'lucide-react';

export default function Stock() {
  const { items } = useStore();
  const [search, setSearch] = useState('');

  // Search filter
  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.barcode.toLowerCase().includes(search.toLowerCase())
  );

  const totalStockCount = items.reduce((acc, curr) => acc + curr.stock, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Full Stock List</h1>
          <p className="text-slate-500">Godown mein maujuda sabhi items aur unki current quantity.</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl text-blue-800 font-bold">
          Total Units: {totalStockCount}
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 text-slate-400" size={20} />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Item ke naam ya barcode se search karein..." 
            className="w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:border-blue-500 text-base"
          />
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b text-slate-600 text-sm">
              <th className="p-4 font-semibold">Product Name</th>
              <th className="p-4 font-semibold">Barcode / SKU</th>
              <th className="p-4 font-semibold text-right">Current Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.map(item => (
              <tr key={item.barcode} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-bold text-slate-800 flex items-center gap-3">
                  <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                    <Package size={18} />
                  </div>
                  {item.name}
                </td>
                <td className="p-4 font-mono text-sm text-slate-500">{item.barcode}</td>
                <td className="p-4 text-right">
                  <span className={`px-3 py-1 rounded-full font-bold text-sm ${item.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {item.stock} Units
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            Koi item nahi mila. Pehle Stock IN mein jaakar item add karein.
          </div>
        )}
      </div>
    </div>
  );
}