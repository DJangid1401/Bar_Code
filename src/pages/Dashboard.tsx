import { useMemo, useState } from 'react';
import { useStore, StockItem, Transaction } from '../store';
import {
  ENABLE_DEMO_MODE,
  formatColorLabel,
  generateOneYearDemoDataset,
  getSavedDemoMode,
  setSavedDemoMode,
} from '../utils/demoSalesData';
import { normalizeUnit, roundQty } from '../utils/qrHelper';
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
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Trophy,
  Filter,
  Layers,
  Palette,
  Ruler,
  Package,
  Users,
  Calendar,
  Search,
  Sparkles,
  Database,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
} from 'lucide-react';

type AnalyticsMetric = 'OUT' | 'MOVEMENT' | 'STOCK';
type TrendFilter = 'ALL' | 'OUT' | 'IN';
type TimeRange = '365D' | '90D' | '30D' | '7D';

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

type LineSeriesBundle = {
  data: Array<Record<string, string | number>>;
  seriesKeys: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function getRangeCutoff(range: TimeRange): number {
  const days =
    range === '365D' ? 365 : range === '90D' ? 90 : range === '30D' ? 30 : 7;
  return Date.now() - days * DAY_MS;
}

function buildPieFromLogsOrItems(
  logs: Transaction[],
  items: StockItem[],
  groupBy: 'color' | 'size',
  metric: AnalyticsMetric,
  hasCustomerOrRangeFilter: boolean
): SliceDatum[] {
  const map = new Map<string, { label: string; value: number; units: Set<string> }>();

  if (metric === 'STOCK' && !hasCustomerOrRangeFilter) {
    for (const item of items) {
      const val = roundQty(item.stock || 0);
      if (val <= 0) continue;
      const rawLabel =
        groupBy === 'color'
          ? formatColorLabel(item.color)
          : (item.size || '').trim() || 'Standard Size';
      const key = rawLabel.toLowerCase();
      const unit = normalizeUnit(item.unit);
      const existing = map.get(key);
      if (existing) {
        existing.value = roundQty(existing.value + val);
        existing.units.add(unit);
      } else {
        map.set(key, { label: rawLabel, value: val, units: new Set([unit]) });
      }
    }
  } else {
    const matchingLogs = logs.filter(l => {
      if (metric === 'OUT') return l.type === 'OUT';
      if (metric === 'STOCK') return l.type === 'OUT';
      return true;
    });

    if (matchingLogs.length > 0) {
      for (const log of matchingLogs) {
        const val = roundQty(log.qty || 0);
        if (val <= 0) continue;
        const rawLabel =
          groupBy === 'color'
            ? formatColorLabel(log.color)
            : (log.size || '').trim() || 'Standard Size';
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
    } else if (!hasCustomerOrRangeFilter) {
      for (const item of items) {
        const val =
          metric === 'OUT'
            ? roundQty(item.totalOut || 0)
            : roundQty((item.totalIn || 0) + (item.totalOut || 0));
        if (val <= 0) continue;
        const rawLabel =
          groupBy === 'color'
            ? formatColorLabel(item.color)
            : (item.size || '').trim() || 'Standard Size';
        const key = rawLabel.toLowerCase();
        const unit = normalizeUnit(item.unit);
        const existing = map.get(key);
        if (existing) {
          existing.value = roundQty(existing.value + val);
          existing.units.add(unit);
        } else {
          map.set(key, { label: rawLabel, value: val, units: new Set([unit]) });
        }
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
  items: StockItem[],
  groupBy: 'name' | 'size' | 'color' | 'customer',
  metric: AnalyticsMetric,
  limit = 8
): RankingDatum[] {
  const map = new Map<string, { label: string; value: number; units: Set<string> }>();

  const useLogs = groupBy === 'customer' || (metric !== 'STOCK' && logs.length > 0);

  if (useLogs) {
    for (const log of logs) {
      if (groupBy === 'customer' && log.type !== 'OUT') continue;
      if (groupBy !== 'customer' && metric === 'OUT' && log.type !== 'OUT') continue;

      const rawLabel =
        groupBy === 'customer'
          ? (log.customerName || '').trim()
          : groupBy === 'name'
          ? log.name.trim()
          : groupBy === 'size'
          ? (log.size || '').trim() || 'Standard Size'
          : formatColorLabel(log.color);

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
  } else {
    for (const item of items) {
      const val =
        metric === 'OUT'
          ? roundQty(item.totalOut || 0)
          : metric === 'STOCK'
          ? roundQty(item.stock || 0)
          : roundQty((item.totalIn || 0) + (item.totalOut || 0));
      if (val <= 0) continue;

      const rawLabel =
        groupBy === 'name'
          ? item.name.trim()
          : groupBy === 'size'
          ? (item.size || '').trim() || 'Standard Size'
          : formatColorLabel(item.color);
      if (!rawLabel) continue;

      const key = rawLabel.toLowerCase();
      const unit = normalizeUnit(item.unit);
      const existing = map.get(key);
      if (existing) {
        existing.value = roundQty(existing.value + val);
        existing.units.add(unit);
      } else {
        map.set(key, { label: rawLabel, value: val, units: new Set([unit]) });
      }
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

function buildCombinedLineChart(
  logs: Transaction[],
  itemsByBarcode: Map<string, StockItem>,
  comboType: 'PRODUCT_COLOR' | 'SIZE_COLOR' | 'PRODUCT_SIZE',
  trendFilter: TrendFilter,
  timeRange: TimeRange
): LineSeriesBundle {
  const filteredLogs = logs
    .filter(log => trendFilter === 'ALL' || log.type === trendFilter)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  if (filteredLogs.length === 0) {
    return { data: [], seriesKeys: [] };
  }

  const uniqueDayKeys = new Set(
    filteredLogs.map(l => {
      const d = new Date(l.timestamp);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const getBucket = (ts: number): { key: string; label: string } => {
    const d = new Date(ts);
    if (timeRange === '365D' && uniqueDayKeys.size > 45) {
      // Monthly buckets across 1 full year (e.g. Nov '25 ... Nov '26)
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString([], { month: 'short', year: '2-digit' });
      return { key, label };
    }
    if (timeRange === '90D' && uniqueDayKeys.size > 21) {
      // Weekly buckets (Monday start)
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const weekStart = new Date(d.getFullYear(), d.getMonth(), diff);
      const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(weekStart.getDate()).padStart(2, '0')}`;
      const label = weekStart.toLocaleDateString([], { day: '2-digit', month: 'short' });
      return { key, label };
    }
    if (uniqueDayKeys.size >= 2) {
      // Daily buckets
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const label = d.toLocaleDateString([], { day: '2-digit', month: 'short' });
      return { key, label };
    }
    // Single day: time slots
    const key = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
      2,
      '0'
    )}`;
    const label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { key, label };
  };

  const getSeriesName = (log: Transaction): string => {
    const refItem = itemsByBarcode.get(log.barcode.toLowerCase());
    const prod = (log.name || refItem?.name || 'Unknown').trim();
    const size = (log.size || refItem?.size || 'Standard').trim();
    const color = formatColorLabel(log.color || refItem?.color);

    if (comboType === 'PRODUCT_COLOR') return `${prod} - ${color}`;
    if (comboType === 'SIZE_COLOR') return `${size} - ${color}`;
    return `${prod} - ${size}`;
  };

  const seriesTotals = new Map<string, number>();
  const bucketMap = new Map<string, { label: string; values: Map<string, number> }>();

  for (const log of filteredLogs) {
    const series = getSeriesName(log);
    const qty = roundQty(log.qty || 0);
    if (qty <= 0) continue;

    seriesTotals.set(series, roundQty((seriesTotals.get(series) || 0) + qty));

    const bucket = getBucket(log.timestamp);
    let bucketEntry = bucketMap.get(bucket.key);
    if (!bucketEntry) {
      bucketEntry = { label: bucket.label, values: new Map() };
      bucketMap.set(bucket.key, bucketEntry);
    }
    bucketEntry.values.set(series, roundQty((bucketEntry.values.get(series) || 0) + qty));
  }

  const topSeries = Array.from(seriesTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const sortedBucketKeys = Array.from(bucketMap.keys()).sort();
  const data = sortedBucketKeys.map(bKey => {
    const entry = bucketMap.get(bKey)!;
    const row: Record<string, string | number> = { time: entry.label };
    for (const sKey of topSeries) {
      row[sKey] = entry.values.get(sKey) || 0;
    }
    return row;
  });

  return { data, seriesKeys: topSeries };
}

const ORDERS_PER_PAGE = 15;

export default function Dashboard() {
  const { items: liveItems, logs: liveLogs, isLoading } = useStore();
  const [useDemoData, setUseDemoData] = useState<boolean>(() => getSavedDemoMode());
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<TimeRange>('365D');
  const metric: AnalyticsMetric = 'OUT';
  const trendFilter: TrendFilter = 'OUT';
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Generate 1-year dummy dataset only when Demo Mode is active
  const demoDataset = useMemo(
    () => (ENABLE_DEMO_MODE && useDemoData ? generateOneYearDemoDataset(liveItems) : null),
    [liveItems, useDemoData]
  );

  const activeItems = demoDataset ? demoDataset.items : liveItems;
  const activeLogs = demoDataset ? demoDataset.logs : liveLogs;

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

  const itemsByBarcode = useMemo(() => {
    const map = new Map<string, StockItem>();
    for (const item of activeItems) {
      map.set(item.barcode.toLowerCase(), item);
    }
    return map;
  }, [activeItems]);

  // Filtered items by Product Selector
  const filteredItems = useMemo(() => {
    if (selectedProduct === 'ALL') return activeItems;
    return activeItems.filter(
      i => i.name.trim().toLowerCase() === selectedProduct.toLowerCase()
    );
  }, [activeItems, selectedProduct]);

  // Filtered logs by Time Range + Product + Customer
  const rangeCutoff = useMemo(() => getRangeCutoff(timeRange), [timeRange]);

  const filteredLogs = useMemo(() => {
    return activeLogs.filter(log => {
      if (log.timestamp < rangeCutoff) return false;
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
  }, [activeLogs, rangeCutoff, selectedProduct, selectedCustomer]);

  // Logs filtered by Time Range + Customer (for global Top Products comparison)
  const rangeCustomerLogs = useMemo(() => {
    return activeLogs.filter(log => {
      if (log.timestamp < rangeCutoff) return false;
      if (
        selectedCustomer !== 'ALL' &&
        (log.customerName || '').trim().toLowerCase() !== selectedCustomer.toLowerCase()
      ) {
        return false;
      }
      return true;
    });
  }, [activeLogs, rangeCutoff, selectedCustomer]);

  const hasCustomerOrRangeFilter = selectedCustomer !== 'ALL' || timeRange !== '365D';

  // Pie / Donut datasets
  const colorsPieData = useMemo(
    () =>
      buildPieFromLogsOrItems(
        filteredLogs,
        filteredItems,
        'color',
        metric,
        hasCustomerOrRangeFilter
      ),
    [filteredLogs, filteredItems, metric, hasCustomerOrRangeFilter]
  );

  const sizesPieData = useMemo(
    () =>
      buildPieFromLogsOrItems(
        filteredLogs,
        filteredItems,
        'size',
        metric,
        hasCustomerOrRangeFilter
      ),
    [filteredLogs, filteredItems, metric, hasCustomerOrRangeFilter]
  );

  // Top Rankings datasets
  const topProducts = useMemo(
    () => buildRankingFromLogsOrItems(rangeCustomerLogs, activeItems, 'name', metric, 7),
    [rangeCustomerLogs, activeItems, metric]
  );
  const topSizes = useMemo(
    () => buildRankingFromLogsOrItems(filteredLogs, filteredItems, 'size', metric, 7),
    [filteredLogs, filteredItems, metric]
  );
  const topColors = useMemo(
    () => buildRankingFromLogsOrItems(filteredLogs, filteredItems, 'color', metric, 8),
    [filteredLogs, filteredItems, metric]
  );
  const topCustomers = useMemo(
    () => buildRankingFromLogsOrItems(filteredLogs, filteredItems, 'customer', 'OUT', 8),
    [filteredLogs, filteredItems]
  );

  // 3 Combined Multi-Series Line Charts
  const productColorTrend = useMemo(
    () =>
      buildCombinedLineChart(
        filteredLogs,
        itemsByBarcode,
        'PRODUCT_COLOR',
        trendFilter,
        timeRange
      ),
    [filteredLogs, itemsByBarcode, trendFilter, timeRange]
  );

  const sizeColorTrend = useMemo(
    () =>
      buildCombinedLineChart(
        filteredLogs,
        itemsByBarcode,
        'SIZE_COLOR',
        trendFilter,
        timeRange
      ),
    [filteredLogs, itemsByBarcode, trendFilter, timeRange]
  );

  const productSizeTrend = useMemo(
    () =>
      buildCombinedLineChart(
        filteredLogs,
        itemsByBarcode,
        'PRODUCT_SIZE',
        trendFilter,
        timeRange
      ),
    [filteredLogs, itemsByBarcode, trendFilter, timeRange]
  );

  // Customer Purchase Orders (OUT logs)
  const customerOrders = useMemo(() => {
    const outOnly = filteredLogs.filter(l => l.type === 'OUT');
    const q = orderSearch.trim().toLowerCase();
    if (!q) return outOnly;
    return outOnly.filter(
      l =>
        (l.customerName || '').toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        (l.size || '').toLowerCase().includes(q) ||
        (l.color || '').toLowerCase().includes(q) ||
        l.barcode.toLowerCase().includes(q)
    );
  }, [filteredLogs, orderSearch]);

  const totalPages = Math.max(1, Math.ceil(customerOrders.length / ORDERS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pagedOrders = useMemo(() => {
    const start = (safePage - 1) * ORDERS_PER_PAGE;
    return customerOrders.slice(start, start + ORDERS_PER_PAGE);
  }, [customerOrders, safePage]);

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

    const days =
      timeRange === '365D' ? 365 : timeRange === '90D' ? 90 : timeRange === '30D' ? 30 : 7;

    return {
      totalOrders: outLogs.length,
      avgPerDay: roundQty(outLogs.length / days),
      activeCustomers: uniqueCust.size,
      dispatchedText: volParts.length > 0 ? volParts.join(' + ') : '0',
      topCustomerName: topCustomers[0]?.name || '—',
      topCustomerVal: topCustomers[0]
        ? `${topCustomers[0].value} ${topCustomers[0].unitHint}`
        : '',
    };
  }, [filteredLogs, timeRange, topCustomers]);

  const metricLabel = 'Sales';

  const rangeLabel =
    timeRange === '365D'
      ? 'Last 1 Year'
      : timeRange === '90D'
      ? 'Last 90 Days'
      : timeRange === '30D'
      ? 'Last 30 Days'
      : 'Last 7 Days';

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
              Product, Size, Color &amp; Customer sales intelligence over time.
            </p>
          </div>

          {/* Demo 1-Year vs Live Sheet Toggle */}
          {ENABLE_DEMO_MODE && (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setUseDemoData(true);
                  setSavedDemoMode(true);
                  setSelectedCustomer('ALL');
                  setPage(1);
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  useDemoData
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles size={14} />
                <span>1-Year Demo (100 Customers • 10/day)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseDemoData(false);
                  setSavedDemoMode(false);
                  setSelectedCustomer('ALL');
                  setPage(1);
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  !useDemoData
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Database size={14} />
                <span>Live Data Only</span>
              </button>
            </div>
          )}
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
              onChange={e => {
                setSelectedProduct(e.target.value);
                setPage(1);
              }}
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
              onChange={e => {
                setSelectedCustomer(e.target.value);
                setPage(1);
              }}
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

          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Calendar size={14} className="text-slate-500 ml-1.5 mr-1" />
            {(
              [
                { id: '365D', label: '1 Year' },
                { id: '90D', label: '90D' },
                { id: '30D', label: '30D' },
                { id: '7D', label: '7D' },
              ] as const
            ).map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setTimeRange(r.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeRange === r.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Sales Indicator */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 ml-auto">
            <span className="px-3.5 py-1 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-xs">
              Sales
            </span>
          </div>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Purchases ({rangeLabel})
          </p>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">
            {scopedStats.totalOrders.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Avg {scopedStats.avgPerDay} customer orders / day
          </p>
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

      {/* SECTION 1: INTERACTIVE FILTERABLE PIE / DONUT CHARTS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Colors Donut Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Palette className="text-blue-600" size={20} />
              <div>
                <h2 className="font-bold text-slate-800 text-base">
                  Colors Distribution —{' '}
                  {selectedProduct === 'ALL' ? 'All Products' : selectedProduct}
                </h2>
                <p className="text-xs text-slate-500">
                  {metricLabel} &bull; {rangeLabel}
                </p>
              </div>
            </div>
            <PieChartIcon size={18} className="text-slate-400" />
          </div>

          <div className="p-5 flex-1">
            {isLoading && activeItems.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">
                Loading analytics...
              </div>
            ) : colorsPieData.length === 0 ? (
              <div className="h-[260px] flex flex-col items-center justify-center text-center space-y-2 text-slate-400">
                <p className="text-sm font-medium text-slate-500">
                  No Sales color data for current filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={colorsPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="54%"
                        outerRadius="84%"
                        paddingAngle={2}
                      >
                        {colorsPieData.map((entry, index) => (
                          <Cell key={`color-cell-${index}`} fill={entry.color} />
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

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {colorsPieData.map(slice => (
                    <div
                      key={slice.name}
                      className="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className="font-semibold text-slate-700 truncate">
                          {slice.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-900">
                          {slice.value} {slice.unitHint}
                        </span>
                        <span className="bg-white border border-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[11px]">
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

        {/* Sizes Donut Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Ruler className="text-emerald-600" size={20} />
              <div>
                <h2 className="font-bold text-slate-800 text-base">
                  Sizes Distribution —{' '}
                  {selectedProduct === 'ALL' ? 'All Products' : selectedProduct}
                </h2>
                <p className="text-xs text-slate-500">
                  {metricLabel} &bull; {rangeLabel}
                </p>
              </div>
            </div>
            <PieChartIcon size={18} className="text-slate-400" />
          </div>

          <div className="p-5 flex-1">
            {isLoading && activeItems.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">
                Loading analytics...
              </div>
            ) : sizesPieData.length === 0 ? (
              <div className="h-[260px] flex flex-col items-center justify-center text-center space-y-2 text-slate-400">
                <p className="text-sm font-medium text-slate-500">
                  No Sales size data for current filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="h-[250px] w-full">
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
                        paddingAngle={2}
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

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {sizesPieData.map(slice => (
                    <div
                      key={slice.name}
                      className="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className="font-semibold text-slate-700 truncate">
                          {slice.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-900">
                          {slice.value} {slice.unitHint}
                        </span>
                        <span className="bg-white border border-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[11px]">
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
      </div>

      {/* SECTION 2: HIGHEST RUNNING / TOP RANKINGS (PRODUCTS, SIZES, COLORS, CUSTOMERS) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="text-amber-500" size={22} />
          <h2 className="text-xl font-bold text-slate-800">
            Highest Running Rankings ({metricLabel} &bull; {rangeLabel})
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Running Products */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm mb-4">
              <Package size={17} className="text-blue-600" />
              Top Running Products
            </h3>
            {topProducts.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-slate-400 text-xs">
                No product data yet.
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
                      width={110}
                      tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }}
                    />
                    <Tooltip
                      formatter={(value, _name, props) => {
                        const d = props?.payload as RankingDatum | undefined;
                        return [`${value ?? 0} ${d?.unitHint || ''}`, 'Volume'];
                      }}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top Customers */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm mb-4">
              <Users size={17} className="text-amber-600" />
              Top Customers (Highest Buyers)
            </h3>
            {topCustomers.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-slate-400 text-xs">
                No customer purchase data yet.
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
                      width={145}
                      tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }}
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
                      width={120}
                      tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }}
                    />
                    <Tooltip
                      formatter={(value, _name, props) => {
                        const d = props?.payload as RankingDatum | undefined;
                        return [`${value ?? 0} ${d?.unitHint || ''}`, 'Volume'];
                      }}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top Running Colors */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm mb-4">
              <Palette size={17} className="text-violet-600" />
              Top Running Colors
            </h3>
            {topColors.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-slate-400 text-xs">
                No color data for this selection.
              </div>
            ) : (
              <div className="h-[230px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topColors}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={86}
                      tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }}
                    />
                    <Tooltip
                      formatter={(value, _name, props) => {
                        const d = props?.payload as RankingDatum | undefined;
                        return [`${value ?? 0} ${d?.unitHint || ''}`, 'Volume'];
                      }}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: 3 COMBINED MULTI-SERIES LINE CHARTS (TRENDS OVER TIME) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-blue-600" size={22} />
            <h2 className="text-xl font-bold text-slate-800">
              Combined Multi-Series Trend Charts ({rangeLabel})
            </h2>
          </div>

          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-xs w-fit">
            <span className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-xs">
              Sales
            </span>
          </div>
        </div>

        {/* 1. Products + Colors */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-base">
              1. Combined Trend — Products + Colors
            </h3>
            <p className="text-xs text-slate-500">
              Comparative trend of top Product &amp; Color combinations over {rangeLabel.toLowerCase()}
            </p>
          </div>
          {productColorTrend.data.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">
              No transaction history found for this filter.
            </div>
          ) : (
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={productColorTrend.data}
                  margin={{ top: 8, right: 20, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  {productColorTrend.seriesKeys.map((key, idx) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={CHART_PALETTE[idx % CHART_PALETTE.length]}
                      strokeWidth={2.5}
                      dot={{ r: 3.5 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 2. Size + Colors & 3. Products + Size */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="mb-4">
              <h3 className="font-bold text-slate-800 text-base">
                2. Combined Trend — Size + Colors
              </h3>
              <p className="text-xs text-slate-500">
                Top Size &amp; Color combinations over {rangeLabel.toLowerCase()}
              </p>
            </div>
            {sizeColorTrend.data.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">
                No transaction history found for this filter.
              </div>
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={sizeColorTrend.data}
                    margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    {sizeColorTrend.seriesKeys.map((key, idx) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={CHART_PALETTE[(idx + 2) % CHART_PALETTE.length]}
                        strokeWidth={2.5}
                        dot={{ r: 3.5 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="mb-4">
              <h3 className="font-bold text-slate-800 text-base">
                3. Combined Trend — Products + Size
              </h3>
              <p className="text-xs text-slate-500">
                Top Product &amp; Size combinations over {rangeLabel.toLowerCase()}
              </p>
            </div>
            {productSizeTrend.data.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">
                No transaction history found for this filter.
              </div>
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={productSizeTrend.data}
                    margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    {productSizeTrend.seriesKeys.map((key, idx) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={CHART_PALETTE[(idx + 4) % CHART_PALETTE.length]}
                        strokeWidth={2.5}
                        dot={{ r: 3.5 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: CUSTOMER PURCHASE HISTORY TABLE (1-YEAR EXPLORER) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="text-blue-600" size={20} />
            <div>
              <h2 className="font-bold text-slate-800 text-base">
                Customer Purchase History ({customerOrders.length.toLocaleString()} Orders)
              </h2>
              <p className="text-xs text-slate-500">
                Daily customer purchases across different products, sizes &amp; colors
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              value={orderSearch}
              onChange={e => {
                setOrderSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search customer, product, size, color..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[720px] text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="p-3.5">Date &amp; Time</th>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5">Product</th>
                <th className="p-3.5">Size</th>
                <th className="p-3.5">Color</th>
                <th className="p-3.5 text-right">Qty Purchased</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3.5 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(order.timestamp).toLocaleString([], {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="p-3.5 font-bold text-slate-800">
                    {order.customerName || 'Walk-in Customer'}
                  </td>
                  <td className="p-3.5">
                    <span className="font-semibold text-slate-700">{order.name}</span>
                    <span className="ml-1.5 text-[11px] font-mono text-slate-400">
                      {order.barcode}
                    </span>
                  </td>
                  <td className="p-3.5 text-xs text-slate-600">
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold">
                      {order.size || '-'}
                    </span>
                  </td>
                  <td className="p-3.5 text-xs text-slate-600">
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold">
                      {formatColorLabel(order.color)}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-bold text-red-600">
                    -{order.qty} {normalizeUnit(order.unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagedOrders.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              No customer purchases match your filter.
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page <strong>{safePage}</strong> of <strong>{totalPages}</strong> (
              {customerOrders.length.toLocaleString()} orders)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 font-semibold flex items-center gap-1 cursor-pointer"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
