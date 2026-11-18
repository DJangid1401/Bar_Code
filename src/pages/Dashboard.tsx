import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { AllowedUnit, normalizeUnit } from '../utils/qrHelper';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Trash2,
  Layers,
  Palette,
  ClipboardList,
} from 'lucide-react';

type ColorBreakdown = {
  colorLabel: string;
  pcs: number;
  kgs: number;
  pac: number;
};

type CategorySummary = {
  categoryName: string;
  totalPcs: number;
  totalKgs: number;
  totalPac: number;
  skuCount: number;
  colors: ColorBreakdown[];
};

type ViewFilter = 'ALL' | 'DISPATCHED' | 'REMAINING' | 'OUT_OF_STOCK';

function getColorDotStyle(colorName: string): string {
  const c = colorName.trim().toLowerCase();
  const map: Record<string, string> = {
    black: '#0f172a',
    white: '#f8fafc',
    red: '#ef4444',
    blue: '#3b82f6',
    'dark blue': '#1e3a8a',
    'navy blue': '#1e3a8a',
    'light blue': '#60a5fa',
    green: '#22c55e',
    yellow: '#eab308',
    orange: '#f97316',
    grey: '#64748b',
    gray: '#64748b',
    silver: '#94a3b8',
    brown: '#92400e',
    pink: '#ec4899',
    purple: '#a855f7',
    gold: '#ca8a04',
  };
  return map[c] || '#6366f1';
}

function formatQtySummary(pcs: number, kgs: number, pac: number): string {
  const parts: string[] = [];
  if (pcs > 0) parts.push(`${pcs} PCS`);
  if (kgs > 0) parts.push(`${kgs} KGS`);
  if (pac > 0) parts.push(`${pac} PAC`);
  return parts.length > 0 ? parts.join(' + ') : '0 PCS';
}

export default function Dashboard() {
  const { items, logs, deleteLog, isLoading, isSyncing } = useStore();
  const [filter, setFilter] = useState<ViewFilter>('ALL');

  const totalItems = items.length;
  const totalPcs = items
    .filter(i => normalizeUnit(i.unit) === 'PCS')
    .reduce((acc, item) => acc + item.stock, 0);
  const totalKgs = items
    .filter(i => normalizeUnit(i.unit) === 'KGS')
    .reduce((acc, item) => acc + item.stock, 0);
  const totalPac = items
    .filter(i => normalizeUnit(i.unit) === 'PAC')
    .reduce((acc, item) => acc + item.stock, 0);

  // Per-product IN / OUT / Remaining flow list
  const itemFlowList = useMemo(() => {
    const inMap = new Map<string, number>();
    const outMap = new Map<string, number>();

    for (const log of logs) {
      const key = log.barcode.toLowerCase();
      if (log.type === 'IN') {
        inMap.set(key, (inMap.get(key) || 0) + (log.qty || 1));
      } else {
        outMap.set(key, (outMap.get(key) || 0) + (log.qty || 1));
      }
    }

    return items.map(item => {
      const key = item.barcode.toLowerCase();
      const computedIn = item.totalIn || inMap.get(key) || item.stock;
      const computedOut = item.totalOut || outMap.get(key) || 0;
      return {
        ...item,
        computedIn,
        computedOut,
      };
    });
  }, [items, logs]);

  const totalInFromItems = itemFlowList.reduce((acc, i) => acc + i.computedIn, 0);
  const totalInFromLogs = logs
    .filter(l => l.type === 'IN')
    .reduce((acc, l) => acc + (l.qty || 1), 0);
  const totalIn = Math.max(totalInFromItems, totalInFromLogs);

  const totalOutFromItems = itemFlowList.reduce((acc, i) => acc + i.computedOut, 0);
  const totalOutFromLogs = logs
    .filter(l => l.type === 'OUT')
    .reduce((acc, l) => acc + (l.qty || 1), 0);
  const totalOut = Math.max(totalOutFromItems, totalOutFromLogs);

  const filteredFlowItems = useMemo(() => {
    switch (filter) {
      case 'DISPATCHED':
        return itemFlowList.filter(i => i.computedOut > 0);
      case 'REMAINING':
        return itemFlowList.filter(i => i.stock > 0);
      case 'OUT_OF_STOCK':
        return itemFlowList.filter(i => i.stock <= 0);
      default:
        return itemFlowList;
    }
  }, [itemFlowList, filter]);

  // Category-Wise & Color-Wise Breakdown
  const categorySummaries = useMemo<CategorySummary[]>(() => {
    const catMap = new Map<
      string,
      {
        categoryName: string;
        totalPcs: number;
        totalKgs: number;
        totalPac: number;
        skuCount: number;
        colorMap: Map<string, ColorBreakdown>;
      }
    >();

    for (const item of items) {
      const catKey = item.name.trim().toLowerCase();
      if (!catKey) continue;

      let cat = catMap.get(catKey);
      if (!cat) {
        cat = {
          categoryName: item.name.trim(),
          totalPcs: 0,
          totalKgs: 0,
          totalPac: 0,
          skuCount: 0,
          colorMap: new Map(),
        };
        catMap.set(catKey, cat);
      }

      const unit: AllowedUnit = normalizeUnit(item.unit);
      cat.skuCount += 1;
      if (unit === 'KGS') {
        cat.totalKgs += item.stock;
      } else if (unit === 'PAC') {
        cat.totalPac += item.stock;
      } else {
        cat.totalPcs += item.stock;
      }

      const colorDisplay = (item.color || '').trim() || 'Unspecified Color';
      const colorKey = colorDisplay.toLowerCase();

      let colorEntry = cat.colorMap.get(colorKey);
      if (!colorEntry) {
        colorEntry = {
          colorLabel: colorDisplay,
          pcs: 0,
          kgs: 0,
          pac: 0,
        };
        cat.colorMap.set(colorKey, colorEntry);
      }

      if (unit === 'KGS') {
        colorEntry.kgs += item.stock;
      } else if (unit === 'PAC') {
        colorEntry.pac += item.stock;
      } else {
        colorEntry.pcs += item.stock;
      }
    }

    return Array.from(catMap.values())
      .map(c => ({
        categoryName: c.categoryName,
        totalPcs: c.totalPcs,
        totalKgs: c.totalKgs,
        totalPac: c.totalPac,
        skuCount: c.skuCount,
        colors: Array.from(c.colorMap.values()).sort(
          (a, b) => b.pcs + b.kgs + b.pac - (a.pcs + a.kgs + a.pac)
        ),
      }))
      .sort(
        (a, b) =>
          b.totalPcs + b.totalKgs + b.totalPac - (a.totalPcs + a.totalKgs + a.totalPac)
      );
  }, [items]);

  const handleDeleteLog = async (id: string, name: string) => {
    if (isSyncing) return;
    if (confirm(`Are you sure you want to delete the transaction log for "${name}"?`)) {
      const res = await deleteLog(id);
      if (!res.success) {
        alert(res.message);
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Inventory Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Live Google Sheets overview — Total Received (IN), Dispatched (OUT), and Remaining Stock.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Remaining Stock
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {formatQtySummary(totalPcs, totalKgs, totalPac)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {categorySummaries.length} Categories in stock
            </p>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl">
            <Package size={26} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-red-600 uppercase tracking-wider">
              Total Dispatched (OUT)
            </p>
            <p className="text-3xl font-extrabold text-red-700 mt-1">-{totalOut}</p>
            <p className="text-xs text-red-600/80 mt-1">Total units dispatched</p>
          </div>
          <div className="bg-red-50 text-red-600 p-3.5 rounded-xl">
            <ArrowUpFromLine size={26} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-green-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-green-600 uppercase tracking-wider">
              Total Received (IN)
            </p>
            <p className="text-3xl font-extrabold text-green-700 mt-1">+{totalIn}</p>
            <p className="text-xs text-green-600/80 mt-1">Total units received</p>
          </div>
          <div className="bg-green-50 text-green-600 p-3.5 rounded-xl">
            <ArrowDownToLine size={26} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Unique Codes
            </p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{totalItems}</p>
            <p className="text-xs text-slate-500 mt-1">Registered SKUs</p>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-3.5 rounded-xl">
            <Layers size={26} />
          </div>
        </div>
      </div>

      {/* Complete Stock Report Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-indigo-600" size={20} />
            <h2 className="font-bold text-slate-800 text-lg">
              Complete Stock Report (Dispatched &amp; Remaining)
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'ALL', label: `All (${itemFlowList.length})` },
                { id: 'DISPATCHED', label: 'Dispatched (OUT > 0)' },
                { id: 'REMAINING', label: 'In Stock (> 0)' },
                { id: 'OUT_OF_STOCK', label: 'Out of Stock' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  filter === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[680px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="p-3.5">Product &amp; Code</th>
                <th className="p-3.5">Size / Color</th>
                <th className="p-3.5 text-right text-green-700">Total IN</th>
                <th className="p-3.5 text-right text-red-700">Total OUT</th>
                <th className="p-3.5 text-right text-blue-700">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredFlowItems.map(item => {
                const unit = normalizeUnit(item.unit);
                return (
                  <tr key={item.barcode} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5">
                      <p className="font-bold text-slate-800">{item.name}</p>
                      <p className="text-xs font-mono text-slate-500">{item.barcode}</p>
                    </td>
                    <td className="p-3.5 text-xs text-slate-600">
                      <div className="flex flex-wrap gap-1.5">
                        {item.size && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold">
                            {item.size}
                          </span>
                        )}
                        {item.color && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold">
                            {item.color}
                          </span>
                        )}
                        {!item.size && !item.color && <span className="text-slate-300">-</span>}
                      </div>
                    </td>
                    <td className="p-3.5 text-right font-bold text-green-700">
                      +{item.computedIn} {unit}
                    </td>
                    <td className="p-3.5 text-right font-bold text-red-600">
                      -{item.computedOut} {unit}
                    </td>
                    <td className="p-3.5 text-right">
                      <span
                        className={`inline-block px-3 py-1 rounded-full font-extrabold text-xs ${
                          item.stock > 0
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.stock} {unit}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredFlowItems.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              {isLoading
                ? 'Loading live data from Google Sheet...'
                : 'No products match this filter.'}
            </div>
          )}
        </div>
      </div>

      {/* Category-Wise & Color-Wise Stock Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Layers className="text-blue-600" size={20} />
            <h2 className="font-bold text-slate-800 text-lg">
              Category-Wise &amp; Color-Wise Remaining Stock
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-lg">
            {categorySummaries.length} Categories
          </span>
        </div>

        <div className="p-5">
          {isLoading && categorySummaries.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              Loading stock data from Google Sheet...
            </div>
          ) : categorySummaries.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              No category stock available yet. Add products via Stock IN or Excel Upload.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {categorySummaries.map(cat => (
                <div
                  key={cat.categoryName}
                  className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 hover:bg-white hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                        {cat.categoryName}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cat.skuCount} {cat.skuCount === 1 ? 'Product Code' : 'Product Codes'} &bull;{' '}
                        {cat.colors.length} {cat.colors.length === 1 ? 'Color' : 'Colors'}
                      </p>
                    </div>
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-extrabold shrink-0 shadow-xs">
                      Total: {formatQtySummary(cat.totalPcs, cat.totalKgs, cat.totalPac)}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Palette size={12} /> Color Breakdown
                    </p>
                    <div className="space-y-1.5">
                      {cat.colors.map(col => (
                        <div
                          key={col.colorLabel}
                          className="flex items-center justify-between bg-white border border-slate-200/80 rounded-lg px-3 py-1.5 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                              style={{ backgroundColor: getColorDotStyle(col.colorLabel) }}
                            ></span>
                            <span className="font-semibold text-slate-700">
                              {col.colorLabel}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 text-xs bg-slate-100 px-2.5 py-0.5 rounded-full">
                            {formatQtySummary(col.pcs, col.kgs, col.pac)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent IN / OUT Activity Feed */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[460px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-base">
            Recent Transactions (IN / OUT History)
          </h3>
          <span className="text-xs font-bold text-slate-400 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
            {logs.length} Logs
          </span>
        </div>
        <div className="p-4 flex-1 overflow-auto divide-y divide-slate-100">
          {logs.map(log => (
            <div
              key={log.id}
              className="flex justify-between items-center py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    log.type === 'IN'
                      ? 'bg-green-50 text-green-600'
                      : 'bg-red-50 text-red-600'
                  }`}
                >
                  {log.type === 'IN' ? (
                    <ArrowDownToLine size={20} />
                  ) : (
                    <ArrowUpFromLine size={20} />
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{log.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span className="font-mono">{log.barcode}</span>
                    <span>&bull;</span>
                    <span>
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {log.source === 'EXCEL_IMPORT' && (
                      <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        Excel
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`font-bold text-sm ${
                    log.type === 'IN' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {log.type === 'IN' ? `+${log.qty || 1}` : `-${log.qty || 1}`}{' '}
                  {normalizeUnit(log.unit)}
                </span>
                <button
                  onClick={() => handleDeleteLog(log.id, log.name)}
                  disabled={isSyncing}
                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 p-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Delete this log"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-slate-400 text-center py-16 text-sm">
              No IN or OUT transactions recorded yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
