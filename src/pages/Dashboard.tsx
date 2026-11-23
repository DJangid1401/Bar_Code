import { useMemo, useState } from 'react';
import { useStore, StockItem, Transaction } from '../store';
import { normalizeUnit, roundQty } from '../utils/qrHelper';
import VoiceSearchButton from '../components/VoiceSearchButton';
import { normalizeVoiceQuery, stringSimilarity } from '../utils/voiceHelper';
import DateRangePicker, {
  DateRangeFilter,
  isTimestampInRange,
  getDateRangeLabel,
} from '../components/DateRangePicker';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieChartIcon,
  Trophy,
  Filter,
  Layers,
  Ruler,
  Package,
  Users,
} from 'lucide-react';

const CHART_PALETTE = [
  '#2563eb', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#84cc16', // Lime
];

type SliceDatum = {
  name: string;
  value: number;
  percent: number;
  unitHint: string;
  color: string;
};

type RankingDatum = {
  name: string;
  value: number;
  unitHint: string;
};

function buildPieFromLogsOrItems(
  logs: Transaction[],
  _items?: StockItem[],
  _hasCustomerOrRangeFilter?: boolean
): SliceDatum[] {
  const map = new Map<string, { label: string; value: number; units: Set<string> }>();

  const matchingLogs = logs.filter(l => l.type === 'OUT');

  if (matchingLogs.length > 0) {
    for (const log of matchingLogs) {
      const val = roundQty(log.qty || 0);
      if (val <= 0) continue;
      const rawLabel = (log.size || '').trim() || 'Standard Size';
      const key = rawLabel.toLowerCase();
      const unit = normalizeUnit(log.unit);
      const existing = map.get(key);
      if (existing) {
        existing.value = roundQty(existing.value + val);
        existing.units.add(unit);
      } else {
        map.set(key, { label: rawLabel, value: val, units: new Set([unit]) });
      }
    }
  }

  const sorted = Array.from(map.values()).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((acc, s) => acc + s.value, 0);
  if (total <= 0) return [];

  const top = sorted.slice(0, 9);
  const rest = sorted.slice(9);
  if (rest.length > 0) {
    const restVal = roundQty(rest.reduce((acc, r) => acc + r.value, 0));
    const restUnits = new Set<string>();
    rest.forEach(r => r.units.forEach(u => restUnits.add(u)));
    top.push({
      label: `Others (${rest.length})`,
      value: restVal,
      units: restUnits,
    });
  }

  return top.map((entry, idx) => ({
    name: entry.label,
    value: entry.value,
    percent: Math.round((entry.value / total) * 1000) / 10,
    unitHint: entry.units.size === 1 ? Array.from(entry.units)[0] : 'Units',
    color: CHART_PALETTE[idx % CHART_PALETTE.length],
  }));
}

function buildRankingFromLogsOrItems(
  logs: Transaction[],
  _items?: StockItem[],
  groupBy: 'name' | 'size' | 'customer' = 'name',
  limit = 8
): RankingDatum[] {
  const map = new Map<string, { label: string; value: number; units: Set<string> }>();

  for (const log of logs) {
    if (log.type !== 'OUT') continue;

    const rawLabel =
      groupBy === 'customer'
        ? (log.customerName || '').trim()
        : groupBy === 'name'
        ? log.name.trim()
        : (log.size || '').trim() || 'Standard Size';

    if (!rawLabel) continue;
    const val = roundQty(log.qty || 0);
    if (val <= 0) continue;

    const key = rawLabel.toLowerCase();
    const unit = normalizeUnit(log.unit);
    const existing = map.get(key);
    if (existing) {
      existing.value = roundQty(existing.value + val);
      existing.units.add(unit);
    } else {
      map.set(key, { label: rawLabel, value: val, units: new Set([unit]) });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map(entry => ({
      name: entry.label,
      value: entry.value,
      unitHint: entry.units.size === 1 ? Array.from(entry.units)[0] : 'Units',
    }));
}

export default function Dashboard() {
  const { items: liveItems, logs: liveLogs, isLoading } = useStore();
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>({ preset: '365D' });

  // 100% Live data strictly from Google Sheets (no dummy/demo datasets)
  const activeItems = liveItems;
  const activeLogs = useMemo(
    () => liveLogs.filter(l => !l.id?.startsWith('demo-')),
    [liveLogs]
  );

  // Unique product names for dropdown
  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of activeItems) {
      const clean = item.name.trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!map.has(key)) map.set(key, clean);
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [activeItems]);

  // Unique customer names for dropdown
  const customerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const log of activeLogs) {
      if (log.customerName?.trim()) set.add(log.customerName.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeLogs]);

  // Filtered items by Product Selector
  const filteredItems = useMemo(() => {
    if (selectedProduct === 'ALL') return activeItems;
    return activeItems.filter(
      i => i.name.trim().toLowerCase() === selectedProduct.toLowerCase()
    );
  }, [activeItems, selectedProduct]);

  // Filtered logs by Date Range + Product + Customer
  const filteredLogs = useMemo(() => {
    return activeLogs.filter(log => {
      if (!isTimestampInRange(log.timestamp, dateFilter)) return false;
      if (
        selectedProduct !== 'ALL' &&
        log.name.trim().toLowerCase() !== selectedProduct.toLowerCase()
      ) {
        return false;
      }
      if (
        selectedCustomer !== 'ALL' &&
        (log.customerName || '').trim().toLowerCase() !== selectedCustomer.toLowerCase()
      ) {
        return false;
      }
      return true;
    });
  }, [activeLogs, dateFilter, selectedProduct, selectedCustomer]);

  // Logs filtered by Date Range + Customer (for Top Products comparison)
  const rangeCustomerLogs = useMemo(() => {
    return activeLogs.filter(log => {
      if (!isTimestampInRange(log.timestamp, dateFilter)) return false;
      if (
        selectedCustomer !== 'ALL' &&
        (log.customerName || '').trim().toLowerCase() !== selectedCustomer.toLowerCase()
      ) {
        return false;
      }
      return true;
    });
  }, [activeLogs, dateFilter, selectedCustomer]);

  const hasCustomerOrRangeFilter =
    selectedCustomer !== 'ALL' || dateFilter.preset !== '365D';

  // Sizes Donut dataset
  const sizesPieData = useMemo(
    () => buildPieFromLogsOrItems(filteredLogs, filteredItems, hasCustomerOrRangeFilter),
    [filteredLogs, filteredItems, hasCustomerOrRangeFilter]
  );

  // Top Rankings datasets
  const topProducts = useMemo(
    () => buildRankingFromLogsOrItems(rangeCustomerLogs, activeItems, 'name', 7),
    [rangeCustomerLogs, activeItems]
  );
  const topSizes = useMemo(
    () => buildRankingFromLogsOrItems(filteredLogs, filteredItems, 'size', 7),
    [filteredLogs, filteredItems]
  );
  const topCustomers = useMemo(
    () => buildRankingFromLogsOrItems(filteredLogs, filteredItems, 'customer', 7),
    [filteredLogs, filteredItems]
  );

  // Scoped KPI summary
  const scopedStats = useMemo(() => {
    const outLogs = filteredLogs.filter(l => l.type === 'OUT');
    const uniqueCust = new Set(outLogs.map(l => l.customerName).filter(Boolean));
    let outKgs = 0;
    let outPac = 0;
    let outPcs = 0;
    for (const l of outLogs) {
      const u = normalizeUnit(l.unit);
      if (u === 'KGS') outKgs += l.qty || 0;
      else if (u === 'PAC') outPac += l.qty || 0;
      else outPcs += l.qty || 0;
    }
    const volParts: string[] = [];
    if (roundQty(outKgs) > 0) volParts.push(`${roundQty(outKgs)} KGS`);
    if (roundQty(outPac) > 0) volParts.push(`${roundQty(outPac)} PAC`);
    if (roundQty(outPcs) > 0) volParts.push(`${roundQty(outPcs)} PCS`);

    return {
      totalOrders: outLogs.length,
      activeCustomers: uniqueCust.size,
      dispatchedText: volParts.length > 0 ? volParts.join(' + ') : '0',
      topCustomerName: topCustomers[0]?.name || '—',
      topCustomerVal: topCustomers[0]
        ? `${topCustomers[0].value} ${topCustomers[0].unitHint}`
        : '',
    };
  }, [filteredLogs, topCustomers]);

  const rangeLabel = getDateRangeLabel(dateFilter);

  const handleDashboardVoiceFilter = (spoken: string) => {
    const q = normalizeVoiceQuery(spoken).toLowerCase().trim();
    if (!q) return;

    if (q === 'all' || q === 'clear' || q === 'reset' || q === 'sab' || q === 'saare') {
      setSelectedProduct('ALL');
      setSelectedCustomer('ALL');
      return;
    }

    let bestProduct: string | null = null;
    let bestProductScore = 0;
    for (const prod of productOptions) {
      const pLower = prod.toLowerCase();
      if (pLower === q || q.includes(pLower) || pLower.includes(q)) {
        bestProduct = prod;
        bestProductScore = 1.0;
        break;
      }
      const sim = stringSimilarity(q, pLower);
      if (sim > bestProductScore && sim >= 0.7) {
        bestProduct = prod;
        bestProductScore = sim;
      }
    }

    let bestCustomer: string | null = null;
    let bestCustomerScore = 0;
    for (const cust of customerOptions) {
      const cLower = cust.toLowerCase();
      if (cLower === q || q.includes(cLower) || cLower.includes(q)) {
        bestCustomer = cust;
        bestCustomerScore = 1.0;
        break;
      }
      const sim = stringSimilarity(q, cLower);
      if (sim > bestCustomerScore && sim >= 0.7) {
        bestCustomer = cust;
        bestCustomerScore = sim;
      }
    }

    if (bestProductScore >= bestCustomerScore && bestProduct) {
      setSelectedProduct(bestProduct);
    } else if (bestCustomer) {
      setSelectedCustomer(bestCustomer);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Data Source Switcher */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2.5">
              <BarChart3 className="text-blue-600" size={30} />
              Analytics Dashboard
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Product, Size &amp; Customer sales intelligence ({rangeLabel}).
            </p>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
          {/* Product Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Filter size={15} className="text-blue-600 shrink-0" />
            <label
              htmlFor="dashboard-product-filter"
              className="text-[11px] font-bold text-slate-500 uppercase"
            >
              Product:
            </label>
            <select
              id="dashboard-product-filter"
              value={selectedProduct}
              onChange={e => setSelectedProduct(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Products</option>
              {productOptions.map(prod => (
                <option key={prod} value={prod}>
                  {prod}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Users size={15} className="text-indigo-600 shrink-0" />
            <label
              htmlFor="dashboard-customer-filter"
              className="text-[11px] font-bold text-slate-500 uppercase"
            >
              Customer:
            </label>
            <select
              id="dashboard-customer-filter"
              value={selectedCustomer}
              onChange={e => setSelectedCustomer(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[200px]"
            >
              <option value="ALL">All Customers ({customerOptions.length})</option>
              {customerOptions.map(cust => (
                <option key={cust} value={cust}>
                  {cust}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Filter Button */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5">
            <VoiceSearchButton
              size="sm"
              buttonTitle="Voice Filter: Bol kar product ya customer filter karein (e.g. Tyre, Ambika, All)"
              showLangToggle={true}
              onTranscript={handleDashboardVoiceFilter}
            />
            <span className="text-[11px] font-bold text-slate-500 pr-1 hidden sm:inline">
              Voice Filter
            </span>
          </div>

          {/* Interactive Date Range Picker with Working Calendar */}
          <DateRangePicker
            value={dateFilter}
            onChange={setDateFilter}
            showPresetsInline={true}
          />
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Orders ({rangeLabel})
          </p>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">
            {scopedStats.totalOrders.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Dispatched sales transactions</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Active Customers
          </p>
          <p className="text-3xl font-extrabold text-indigo-800 mt-1">
            {scopedStats.activeCustomers}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedCustomer === 'ALL' ? 'Unique buying customers' : selectedCustomer}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-500">
            Total Sales ({rangeLabel})
          </p>
          <p className="text-xl font-extrabold text-red-700 mt-1 leading-snug">
            {scopedStats.dispatchedText}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedProduct === 'ALL' ? 'Across all products' : selectedProduct}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
            Top Customer
          </p>
          <p className="text-lg font-extrabold text-slate-900 mt-1 truncate">
            {scopedStats.topCustomerName}
          </p>
          <p className="text-xs text-amber-700 font-semibold mt-0.5">
            {scopedStats.topCustomerVal || 'No orders yet'}
          </p>
        </div>
      </div>

      {/* SIZES DISTRIBUTION DONUT CHART */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ruler className="text-emerald-600" size={20} />
            <div>
              <h2 className="font-bold text-slate-800 text-base">
                Sizes Distribution —{' '}
                {selectedProduct === 'ALL' ? 'All Products' : selectedProduct}
              </h2>
              <p className="text-xs text-slate-500">Sales &bull; {rangeLabel}</p>
            </div>
          </div>
          <PieChartIcon size={18} className="text-slate-400" />
        </div>

        <div className="p-6">
          {isLoading && activeItems.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">
              Loading analytics...
            </div>
          ) : sizesPieData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">
              No size data for current selection.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sizesPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="54%"
                      outerRadius="84%"
                      paddingAngle={3}
                    >
                      {sizesPieData.map((entry, index) => (
                        <Cell key={`size-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, _name, props) => {
                        const payload = props?.payload as SliceDatum | undefined;
                        return [
                          `${value ?? 0} ${payload?.unitHint || ''} (${payload?.percent ?? 0}%)`,
                          payload?.name || '',
                        ];
                      }}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {sizesPieData.map(slice => (
                  <div
                    key={slice.name}
                    className="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="font-semibold text-slate-800 truncate">
                        {slice.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-900">
                        {slice.value} {slice.unitHint}
                      </span>
                      <span className="bg-white border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-md text-[11px]">
                        {slice.percent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TOP RANKINGS: 3 CLEAN CARDS (PRODUCTS, CUSTOMERS, SIZES) */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="text-amber-500" size={22} />
          <h2 className="text-xl font-bold text-slate-800">
            Top Rankings ({rangeLabel})
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Top Running Products */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm mb-4">
              <Package size={17} className="text-blue-600" />
              Top Running Products
            </h3>
            {topProducts.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-slate-400 text-xs">
                No product movement in this range.
              </div>
            ) : (
              <div className="h-[230px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProducts}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }}
                    />
                    <Tooltip
                      formatter={(value, _name, props) => {
                        const d = props?.payload as RankingDatum | undefined;
                        return [`${value ?? 0} ${d?.unitHint || ''}`, 'Sales'];
                      }}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top Customers (Highest Buyers) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm mb-4">
              <Users size={17} className="text-amber-500" />
              Top Customers (Highest Buyers)
            </h3>
            {topCustomers.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-slate-400 text-xs">
                No customer orders for this selection.
              </div>
            ) : (
              <div className="h-[230px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topCustomers}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fontSize: 10, fill: '#1e293b', fontWeight: 600 }}
                    />
                    <Tooltip
                      formatter={(value, _name, props) => {
                        const d = props?.payload as RankingDatum | undefined;
                        return [`${value ?? 0} ${d?.unitHint || ''}`, 'Purchased'];
                      }}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top Running Sizes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm mb-4">
              <Layers size={17} className="text-emerald-600" />
              Top Running Sizes
            </h3>
            {topSizes.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-slate-400 text-xs">
                No size data for this selection.
              </div>
            ) : (
              <div className="h-[230px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topSizes}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }}
                    />
                    <Tooltip
                      formatter={(value, _name, props) => {
                        const d = props?.payload as RankingDatum | undefined;
                        return [`${value ?? 0} ${d?.unitHint || ''}`, 'Sales'];
                      }}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
