import { useMemo, useState } from 'react';
import { useStore } from '../store';
import {
  ENABLE_DEMO_MODE,
  formatColorLabel,
  generateOneYearDemoDataset,
  getSavedDemoMode,
  setSavedDemoMode,
} from '../utils/demoSalesData';
import { normalizeUnit, roundQty } from '../utils/qrHelper';
import DateRangePicker, {
  DateRangeFilter,
  isTimestampInRange,
  getDateRangeLabel,
} from '../components/DateRangePicker';
import {
  ShoppingBag,
  Search,
  Filter,
  Users,
  Sparkles,
  Database,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';

const ORDERS_PER_PAGE = 20;

export default function Sales() {
  const { items: liveItems, logs: liveLogs, isLoading } = useStore();
  const [useDemoData, setUseDemoData] = useState<boolean>(() => getSavedDemoMode());
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>({ preset: '365D' });
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const demoDataset = useMemo(
    () => (ENABLE_DEMO_MODE && useDemoData ? generateOneYearDemoDataset(liveItems) : null),
    [liveItems, useDemoData]
  );

  const activeItems = demoDataset ? demoDataset.items : liveItems;
  const activeLogs = demoDataset ? demoDataset.logs : liveLogs;

  // All OUT (Sales) logs
  const salesLogs = useMemo(
    () => activeLogs.filter(l => l.type === 'OUT'),
    [activeLogs]
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
    for (const log of salesLogs) {
      const clean = log.name.trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!map.has(key)) map.set(key, clean);
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [activeItems, salesLogs]);

  // Unique customer names for dropdown
  const customerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const log of salesLogs) {
      if (log.customerName?.trim()) set.add(log.customerName.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [salesLogs]);

  // Apply date range, product, customer & text search filters
  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();

    return salesLogs.filter(log => {
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
      if (q) {
        const colorText = formatColorLabel(log.color).toLowerCase();
        const matches =
          (log.customerName || '').toLowerCase().includes(q) ||
          log.name.toLowerCase().includes(q) ||
          (log.size || '').toLowerCase().includes(q) ||
          colorText.includes(q) ||
          log.barcode.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [salesLogs, dateFilter, selectedProduct, selectedCustomer, orderSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const pagedOrders = useMemo(() => {
    const start = (safePage - 1) * ORDERS_PER_PAGE;
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE);
  }, [filteredOrders, safePage]);

  // Summary metrics
  const summary = useMemo(() => {
    const uniqueCust = new Set(
      filteredOrders.map(l => (l.customerName || '').trim()).filter(Boolean)
    );
    let kgs = 0;
    let pac = 0;
    let pcs = 0;
    let totalRevenue = 0;

    for (const l of filteredOrders) {
      const u = normalizeUnit(l.unit);
      if (u === 'KGS') kgs += l.qty || 0;
      else if (u === 'PAC') pac += l.qty || 0;
      else pcs += l.qty || 0;

      const lineTotal = l.totalAmount ?? (l.price != null ? l.price * l.qty : 0);
      totalRevenue += lineTotal;
    }
    const parts: string[] = [];
    if (roundQty(kgs) > 0) parts.push(`${roundQty(kgs)} KGS`);
    if (roundQty(pac) > 0) parts.push(`${roundQty(pac)} PAC`);
    if (roundQty(pcs) > 0) parts.push(`${roundQty(pcs)} PCS`);

    return {
      totalOrders: filteredOrders.length,
      activeCustomers: uniqueCust.size,
      volumeText: parts.length > 0 ? parts.join(' + ') : '0',
      totalRevenue: Math.round(totalRevenue),
    };
  }, [filteredOrders]);

  const rangeLabel = getDateRangeLabel(dateFilter);

  const handleExportCsv = () => {
    const header = [
      'Date & Time',
      'Customer Name',
      'Product',
      'Unique Code',
      'Size',
      'Color',
      'Price (₹)',
      'Qty Purchased',
      'Unit',
      'Total Amount (₹)',
    ];
    const escapeCell = (val: string | number) => {
      const s = String(val ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = filteredOrders.map(o => {
      const lineTotal = o.totalAmount ?? (o.price != null ? o.price * o.qty : '');
      return [
        new Date(o.timestamp).toLocaleString(),
        o.customerName || 'Walk-in Customer',
        o.name,
        o.barcode,
        o.size || '-',
        formatColorLabel(o.color),
        o.price != null ? o.price : '',
        o.qty,
        normalizeUnit(o.unit),
        lineTotal !== '' ? roundQty(Number(lineTotal)) : '',
      ];
    });
    const csv = [header, ...rows].map(r => r.map(escapeCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Swati_Full_Sales_${rangeLabel.replace(/[\s/]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Filters */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2.5">
              <ShoppingBag className="text-blue-600" size={30} />
              Full Sales
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Complete customer purchase history across products, sizes &amp; colors.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
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

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredOrders.length === 0}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
          {/* Product Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Filter size={15} className="text-blue-600 shrink-0" />
            <label
              htmlFor="sales-product-filter"
              className="text-[11px] font-bold text-slate-500 uppercase"
            >
              Product:
            </label>
            <select
              id="sales-product-filter"
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
              htmlFor="sales-customer-filter"
              className="text-[11px] font-bold text-slate-500 uppercase"
            >
              Customer:
            </label>
            <select
              id="sales-customer-filter"
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

          {/* Interactive Date Range Picker with Calendar Popover */}
          <DateRangePicker
            value={dateFilter}
            onChange={f => {
              setDateFilter(f);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Orders ({rangeLabel})
          </p>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">
            {summary.totalOrders.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Customer purchases completed</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Buying Customers
          </p>
          <p className="text-3xl font-extrabold text-indigo-800 mt-1">
            {summary.activeCustomers}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedCustomer === 'ALL' ? 'Unique active buyers' : selectedCustomer}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-500">
            Total Sales Volume ({rangeLabel})
          </p>
          <p className="text-xl font-extrabold text-red-700 mt-1 leading-snug">
            {summary.volumeText}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedProduct === 'ALL' ? 'Across all products' : selectedProduct}
          </p>
        </div>
      </div>

      {/* Customer Purchase History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="text-blue-600" size={20} />
            <div>
              <h2 className="font-bold text-slate-800 text-base">
                Customer Purchase History ({filteredOrders.length.toLocaleString()} Orders)
              </h2>
              <p className="text-xs text-slate-500">
                Daily customer purchases across different products, sizes &amp; colors
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-80">
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
          <table className="w-full text-left border-collapse min-w-[880px] text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="p-3.5">Date &amp; Time</th>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5">Product</th>
                <th className="p-3.5">Size</th>
                <th className="p-3.5">Color</th>
                <th className="p-3.5 text-right">Price (₹)</th>
                <th className="p-3.5 text-right">Qty Purchased</th>
                <th className="p-3.5 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && activeItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                    Loading sales records...
                  </td>
                </tr>
              ) : (
                pagedOrders.map(order => (
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
                    <td className="p-3.5 text-right font-semibold text-slate-700 whitespace-nowrap">
                      {order.price != null && order.price > 0
                        ? `₹${order.price.toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td className="p-3.5 text-right font-bold text-red-600 whitespace-nowrap">
                      -{order.qty} {normalizeUnit(order.unit)}
                    </td>
                    <td className="p-3.5 text-right font-bold text-emerald-700 whitespace-nowrap">
                      {(() => {
                        const total =
                          order.totalAmount ??
                          (order.price != null ? order.price * order.qty : null);
                        return total != null && total > 0
                          ? `₹${roundQty(total).toLocaleString('en-IN')}`
                          : '—';
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!isLoading && pagedOrders.length === 0 && (
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
              {filteredOrders.length.toLocaleString()} orders)
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
