import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { AllowedUnit, normalizeUnit, roundQty } from '../utils/qrHelper';
import VoiceSearchButton from '../components/VoiceSearchButton';
import { normalizeVoiceQuery } from '../utils/voiceHelper';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Trash2,
  Layers,
  Palette,
  ClipboardList,
  Clock,
  User,
  Search,
  X,
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
  const p = roundQty(pcs);
  const k = roundQty(kgs);
  const pk = roundQty(pac);
  if (p > 0) parts.push(`${p} PCS`);
  if (k > 0) parts.push(`${k} KGS`);
  if (pk > 0) parts.push(`${pk} PAC`);
  return parts.length > 0 ? parts.join(' + ') : '0 KGS';
}

export default function Activity() {
  const { items, logs, currentUser, deleteLog, isLoading, isSyncing } = useStore();
  const isAdmin = currentUser?.role === 'Admin';
  const [filter, setFilter] = useState<ViewFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const totalItems = items.length;

  // Real transaction logs only (strictly ignoring any demo dataset logs)
  const realLogs = useMemo(
    () => logs.filter(l => !l.id?.startsWith('demo-')),
    [logs]
  );
  const realInLogs = useMemo(() => realLogs.filter(l => l.type === 'IN'), [realLogs]);
  const realOutLogs = useMemo(() => realLogs.filter(l => l.type === 'OUT'), [realLogs]);

  // Per-product IN / OUT / Remaining flow strictly from real logs
  const itemFlowList = useMemo(() => {
    const inMap = new Map<string, number>();
    const outMap = new Map<string, number>();

    for (const log of realInLogs) {
      const key = log.barcode.toLowerCase();
      inMap.set(key, roundQty((inMap.get(key) || 0) + (log.qty || 0)));
    }

    for (const log of realOutLogs) {
      const key = log.barcode.toLowerCase();
      outMap.set(key, roundQty((outMap.get(key) || 0) + (log.qty || 0)));
    }

    const seen = new Set<string>();
    const list = items.map(item => {
      const key = item.barcode.toLowerCase();
      seen.add(key);
      const computedIn = inMap.get(key) || 0;
      const computedOut = outMap.get(key) || 0;
      const computedRemaining = roundQty(Math.max(0, computedIn - computedOut));
      return {
        ...item,
        computedIn,
        computedOut,
        stock: computedRemaining,
      };
    });

    for (const log of realLogs) {
      const key = log.barcode.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        const computedIn = inMap.get(key) || 0;
        const computedOut = outMap.get(key) || 0;
        const computedRemaining = roundQty(Math.max(0, computedIn - computedOut));
        list.push({
          barcode: log.barcode,
          name: log.name,
          size: log.size || '',
          color: log.color || '',
          stock: computedRemaining,
          computedIn,
          computedOut,
          totalIn: computedIn,
          totalOut: computedOut,
          unit: log.unit || 'PCS',
        });
      }
    }

    return list;
  }, [items, realInLogs, realOutLogs, realLogs]);

  // Real Remaining Stock by unit (computed strictly from real IN - real OUT)
  const totalPcs = roundQty(
    itemFlowList
      .filter(i => normalizeUnit(i.unit) === 'PCS')
      .reduce((acc, item) => acc + item.stock, 0)
  );
  const totalKgs = roundQty(
    itemFlowList
      .filter(i => normalizeUnit(i.unit) === 'KGS')
      .reduce((acc, item) => acc + item.stock, 0)
  );
  const totalPac = roundQty(
    itemFlowList
      .filter(i => normalizeUnit(i.unit) === 'PAC')
      .reduce((acc, item) => acc + item.stock, 0)
  );
  const hasAnyRemaining = totalPcs > 0 || totalKgs > 0 || totalPac > 0;

  // Real Received (IN) by unit strictly from real IN logs
  const sumInByUnit = (targetUnit: AllowedUnit) => {
    return roundQty(
      realInLogs
        .filter(l => normalizeUnit(l.unit) === targetUnit)
        .reduce((acc, l) => acc + (l.qty || 0), 0)
    );
  };

  const totalInPcs = sumInByUnit('PCS');
  const totalInKgs = sumInByUnit('KGS');
  const totalInPac = sumInByUnit('PAC');
  const hasAnyIn = totalInPcs > 0 || totalInKgs > 0 || totalInPac > 0;

  // Real Dispatched (OUT) by unit strictly from real OUT logs
  const sumOutByUnit = (targetUnit: AllowedUnit) => {
    return roundQty(
      realOutLogs
        .filter(l => normalizeUnit(l.unit) === targetUnit)
        .reduce((acc, l) => acc + (l.qty || 0), 0)
    );
  };

  const totalOutPcs = sumOutByUnit('PCS');
  const totalOutKgs = sumOutByUnit('KGS');
  const totalOutPac = sumOutByUnit('PAC');
  const hasAnyOut = totalOutPcs > 0 || totalOutKgs > 0 || totalOutPac > 0;

  const filteredFlowItems = useMemo(() => {
    let list = itemFlowList;
    switch (filter) {
      case 'DISPATCHED':
        list = list.filter(i => i.computedOut > 0);
        break;
      case 'REMAINING':
        list = list.filter(i => i.stock > 0);
        break;
      case 'OUT_OF_STOCK':
        list = list.filter(i => i.stock <= 0);
        break;
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        i =>
          i.name.toLowerCase().includes(q) ||
          i.barcode.toLowerCase().includes(q) ||
          (i.size && i.size.toLowerCase().includes(q)) ||
          (i.color && i.color.toLowerCase().includes(q))
      );
    }
    return list;
  }, [itemFlowList, filter, searchQuery]);

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

      const colorDisplay = (item.color || '').trim() || 'Fixed';
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
          <h1 className="text-3xl font-bold text-slate-800">Activity</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time inventory overview — Total Received (IN), Dispatched (OUT), and Remaining Stock.
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
              {hasAnyRemaining ? formatQtySummary(totalPcs, totalKgs, totalPac) : '0'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {totalKgs > 0
                ? `${totalKgs} KGS = ${roundQty(totalKgs * 2)} pkts (500g)`
                : `${categorySummaries.length} Categories in stock`}
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
            <p className="text-2xl font-extrabold text-red-700 mt-1">
              {hasAnyOut ? `-${formatQtySummary(totalOutPcs, totalOutKgs, totalOutPac)}` : '0'}
            </p>
            <p className="text-xs text-red-600/80 mt-1">
              {totalOutKgs > 0
                ? `${totalOutKgs} KGS = ${roundQty(totalOutKgs * 2)} pkts (500g)`
                : 'Unit-wise dispatched total'}
            </p>
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
            <p className="text-2xl font-extrabold text-green-700 mt-1">
              {hasAnyIn ? `+${formatQtySummary(totalInPcs, totalInKgs, totalInPac)}` : '0'}
            </p>
            <p className="text-xs text-green-600/80 mt-1">
              {totalInKgs > 0
                ? `${totalInKgs} KGS = ${roundQty(totalInKgs * 2)} pkts (500g)`
                : 'Unit-wise received total'}
            </p>
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
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-indigo-600" size={20} />
            <h2 className="font-bold text-slate-800 text-lg">
              Complete Stock Report (Dispatched &amp; Remaining)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search product, code, size, color..."
                className="w-full pl-8 pr-16 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
              />
              <div className="absolute right-1 top-0.5 flex items-center">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
                <VoiceSearchButton
                  size="sm"
                  buttonTitle="Search report by voice"
                  showLangToggle={true}
                  onTranscript={spoken => setSearchQuery(normalizeVoiceQuery(spoken))}
                />
              </div>
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
                <th className="p-3.5 text-right">Updated By</th>
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
                    <td className="p-3.5 text-right text-xs font-semibold text-slate-500">
                      {item.updatedBy || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredFlowItems.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              {isLoading
                ? 'Loading live inventory data...'
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
              Loading stock data...
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
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="font-mono text-slate-600">{log.barcode}</span>
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
                      <User size={11} /> {log.doneBy || 'Admin'}
                    </span>
                    {log.customerName && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
                        Customer: {log.customerName}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-slate-500 text-[11px] font-medium">
                      <Clock size={11} />
                      {new Date(log.timestamp).toLocaleString([], {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
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
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteLog(log.id, log.name)}
                    disabled={isSyncing}
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Delete this log"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
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
