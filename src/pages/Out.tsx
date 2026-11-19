import { useMemo, useState, useRef, useEffect } from 'react';
import { useStore, StockItem } from '../store';
import QRScanner from '../components/QRScanner';
import {
  DUMMY_CUSTOMERS,
  ENABLE_DEMO_MODE,
  getSavedDemoMode,
  formatColorLabel,
  FALLBACK_CATALOG,
  CatalogEntry,
} from '../utils/demoSalesData';
import {
  normalizeUnit,
  parseScannedQR,
  PACKET_WEIGHT_KG,
  packetsToKg,
  roundQty,
  sanitizeDecimalInput,
} from '../utils/qrHelper';
import {
  ArrowUpFromLine,
  QrCode,
  MinusCircle,
  AlertCircle,
  Package,
  Scale,
  User,
  IndianRupee,
  Search,
  ChevronDown,
  X,
  Check,
} from 'lucide-react';

type OutKgMode = 'PACKETS_500G' | 'DIRECT_KG';

export default function Out() {
  const { items, logs, customers, scanOut, isSyncing } = useStore();
  const [showScanner, setShowScanner] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [priceInput, setPriceInput] = useState<string>('');
  const [qty, setQty] = useState<string>('1');
  const [outKgMode, setOutKgMode] = useState<OutKgMode>('PACKETS_500G');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Combined customer suggestions: from Customer DB + past logs + demo customers
  const customerSuggestions = useMemo(() => {
    const list: Array<{ name: string; label: string }> = [];
    const seen = new Set<string>();

    // 1. Registered Customer DB records
    for (const c of customers) {
      const trimmed = c.name.trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
      seen.add(trimmed.toLowerCase());
      list.push({
        name: trimmed,
        label: c.gst ? `${trimmed} (GST: ${c.gst})` : trimmed,
      });
    }

    // 2. Past transaction logs
    for (const log of logs) {
      const trimmed = (log.customerName || '').trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
      seen.add(trimmed.toLowerCase());
      list.push({ name: trimmed, label: trimmed });
    }

    // 3. Demo customers (if enabled)
    if (ENABLE_DEMO_MODE && getSavedDemoMode()) {
      for (const d of DUMMY_CUSTOMERS) {
        if (!seen.has(d.toLowerCase())) {
          seen.add(d.toLowerCase());
          list.push({ name: d, label: d });
        }
      }
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, logs]);

  const detectedItem = items.find(
    i => i.barcode.toLowerCase() === barcode.trim().toLowerCase()
  );

  // Helper to resolve unit selling price from Google Sheet item, with catalog fallback
  const getItemSellingPrice = (item?: StockItem): number | undefined => {
    if (!item) return undefined;
    if (
      item.price !== undefined &&
      item.price !== null &&
      item.price > 0 &&
      item.price < 100000000000
    ) {
      return roundQty(item.price);
    }
    // Fallback price from predefined catalog
    const catalogEntry = FALLBACK_CATALOG.find(
      (c: CatalogEntry) => c.barcode.toLowerCase() === item.barcode.toLowerCase()
    );
    if (catalogEntry && catalogEntry.price && catalogEntry.price > 0) {
      return catalogEntry.price;
    }
    return undefined;
  };

  // Sync automated selling price when detected item changes
  useEffect(() => {
    if (detectedItem) {
      const autoPrice = getItemSellingPrice(detectedItem);
      if (autoPrice !== undefined) {
        setPriceInput(String(autoPrice));
      }
    }
  }, [detectedItem]);

  // Filtered products for dropdown: search by Unique Code, Product Name, Size, or Color
  const matchingItems = useMemo(() => {
    const q = searchProduct.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => {
      const code = i.barcode.toLowerCase();
      const name = i.name.toLowerCase();
      const size = (i.size || '').toLowerCase();
      const color = formatColorLabel(i.color).toLowerCase();
      return (
        code.includes(q) ||
        name.includes(q) ||
        size.includes(q) ||
        color.includes(q)
      );
    });
  }, [items, searchProduct]);

  const detectedUnit = detectedItem ? normalizeUnit(detectedItem.unit) : 'PCS';
  const isKgs = detectedUnit === 'KGS';

  const rawNumber =
    isKgs && outKgMode === 'DIRECT_KG' ? parseFloat(qty) || 0 : parseInt(qty, 10) || 0;

  const finalQtyToDeduct =
    isKgs && outKgMode === 'PACKETS_500G'
      ? packetsToKg(rawNumber)
      : roundQty(rawNumber);

  const remainingAfterOut = detectedItem
    ? roundQty(detectedItem.stock - finalQtyToDeduct)
    : 0;

  const maxPackets = detectedItem
    ? Math.floor(detectedItem.stock / PACKET_WEIGHT_KG)
    : 0;

  const parsedUnitPrice = parseFloat(priceInput) > 0 ? parseFloat(priceInput) : undefined;
  const calculatedTotalAmount =
    parsedUnitPrice !== undefined ? roundQty(finalQtyToDeduct * parsedUnitPrice) : undefined;

  const handleSelectProduct = (item: StockItem) => {
    setBarcode(item.barcode);
    setSearchProduct(item.barcode);
    const autoPrice = getItemSellingPrice(item);
    if (autoPrice !== undefined) {
      setPriceInput(String(autoPrice));
    } else {
      setPriceInput('');
    }
    setIsDropdownOpen(false);
  };

  const handleSearchChange = (val: string) => {
    setSearchProduct(val);
    setIsDropdownOpen(true);
    const clean = val.trim();
    // If user typed or pasted exact barcode
    const exact = items.find(i => i.barcode.toLowerCase() === clean.toLowerCase());
    if (exact) {
      setBarcode(exact.barcode);
      const autoPrice = getItemSellingPrice(exact);
      if (autoPrice !== undefined) {
        setPriceInput(String(autoPrice));
      }
    } else {
      setBarcode(clean);
    }
  };

  const handleClearProduct = () => {
    setBarcode('');
    setSearchProduct('');
    setPriceInput('');
    setIsDropdownOpen(false);
  };

  const handleScanSuccess = (decodedText: string) => {
    setShowScanner(false);
    const parsed = parseScannedQR(decodedText);
    const cleanCode = parsed.barcode.trim();
    setBarcode(cleanCode);
    setSearchProduct(cleanCode);
    const matched = items.find(i => i.barcode.toLowerCase() === cleanCode.toLowerCase());
    if (matched) {
      const autoPrice = getItemSellingPrice(matched);
      if (autoPrice !== undefined) {
        setPriceInput(String(autoPrice));
      }
    }
    setQty('1');
  };

  const handleSwitchMode = (mode: OutKgMode) => {
    setOutKgMode(mode);
    setQty('1');
  };

  const handleStep = (delta: number) => {
    if (isKgs && outKgMode === 'DIRECT_KG') {
      const next = roundQty(Math.max(0.5, rawNumber + delta * 0.5));
      setQty(
        String(detectedItem ? Math.min(detectedItem.stock, next) : next)
      );
    } else if (isKgs && outKgMode === 'PACKETS_500G') {
      const next = Math.max(1, Math.round(rawNumber) + delta);
      setQty(
        String(detectedItem && maxPackets > 0 ? Math.min(maxPackets, next) : next)
      );
    } else {
      const next = Math.max(1, Math.round(rawNumber) + delta);
      setQty(
        String(detectedItem ? Math.min(detectedItem.stock, next) : next)
      );
    }
  };

  const handleManualOut = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode) {
      alert('Please enter or select a Unique Product Code to process Stock OUT.');
      return;
    }

    if (!detectedItem) {
      alert('Error: This product is not registered in inventory.');
      return;
    }

    if (!finalQtyToDeduct || finalQtyToDeduct <= 0) {
      alert('Please enter a valid dispatch quantity greater than 0.');
      return;
    }

    if (detectedItem.stock < finalQtyToDeduct) {
      alert(
        `Error: Insufficient stock! Available: ${detectedItem.stock} ${detectedUnit}, Requested: ${finalQtyToDeduct} ${detectedUnit}.`
      );
      return;
    }

    if (!customerName.trim()) {
      alert('Please enter Customer Name for Stock OUT.');
      return;
    }

    const result = await scanOut({
      barcode: trimmedBarcode,
      qty: finalQtyToDeduct,
      customerName: customerName.trim(),
      price: parsedUnitPrice,
      totalAmount: calculatedTotalAmount,
    });

    alert(result.message);
    if (result.success) {
      setBarcode('');
      setSearchProduct('');
      setCustomerName('');
      setPriceInput('');
      setQty('1');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-4 pb-12">
      <div className="text-center space-y-2">
        <div className="bg-red-100 text-red-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
          <ArrowUpFromLine size={32} />
        </div>
        <h1 className="text-3xl font-bold text-slate-800">Stock OUT (Dispatch / Sale)</h1>
        <p className="text-slate-500 text-xs">
          Search by Unique Code, Product Name, Size, or Color.
        </p>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        {/* Camera Scan Button */}
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="bg-red-600 hover:bg-red-700 text-white text-base font-bold py-3.5 px-6 rounded-xl w-full flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          <QrCode size={22} />
          <span>Scan QR / Barcode</span>
        </button>

        <div className="flex items-center gap-4 text-slate-400">
          <div className="flex-1 h-px bg-slate-200"></div>
          <span className="text-xs font-bold tracking-wider uppercase text-slate-400">
            Dispatch Details
          </span>
          <div className="flex-1 h-px bg-slate-200"></div>
        </div>

        {/* Detected Item Information Box */}
        {detectedItem ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <Package size={20} className="text-blue-600" />
                  {detectedItem.name}
                </p>
                <p className="text-xs font-mono text-slate-500 mt-0.5">
                  Code: <strong className="text-slate-800">{detectedItem.barcode}</strong>
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                    detectedItem.stock > 0
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  Stock: {detectedItem.stock} {detectedUnit}
                </span>
                {(() => {
                  const p = getItemSellingPrice(detectedItem);
                  return p !== undefined ? (
                    <p className="text-xs font-bold text-blue-700 mt-1">
                      Selling Price: ₹{p} / {detectedUnit}
                    </p>
                  ) : null;
                })()}
                {isKgs && (
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    ({maxPackets} packets of 500g available)
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-600 pt-1 border-t border-slate-200">
              {detectedItem.size && (
                <span>
                  Size: <strong>{detectedItem.size}</strong>
                </span>
              )}
              {detectedItem.color && (
                <span>
                  Color: <strong>{formatColorLabel(detectedItem.color)}</strong>
                </span>
              )}
              <span>
                Base Unit: <strong>{detectedUnit}</strong>
              </span>
            </div>
          </div>
        ) : barcode.trim() ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <span>
              Product &quot;{barcode}&quot; is not registered. Choose an item from the dropdown below.
            </span>
          </div>
        ) : null}

        {/* Dispatch Form */}
        <form onSubmit={handleManualOut} className="space-y-4">
          {/* Customer Name Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Customer Name * <span className="text-xs font-normal text-slate-400">(Registered DB / Walk-in)</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
              <input
                type="text"
                list="customer-name-suggestions"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Enter or select customer name (e.g. Shree Ganesh Traders)"
                className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-xl text-base focus:border-red-500 focus:outline-none"
                required
              />
              <datalist id="customer-name-suggestions">
                {customerSuggestions.map(cust => (
                  <option key={cust.name} value={cust.name}>
                    {cust.label}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          {/* SEARCHABLE UNIQUE PRODUCT CODE + NAME + SIZE + COLOR DROPDOWN */}
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-slate-700">
                Unique Product Code * <span className="text-xs font-normal text-slate-400">(Search by Code, Name, Size, or Color)</span>
              </label>
              {barcode && (
                <button
                  type="button"
                  onClick={handleClearProduct}
                  className="text-xs font-bold text-red-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
              <input
                type="text"
                value={searchProduct}
                onChange={e => handleSearchChange(e.target.value)}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Search Unique Code, Product Name, Size, or Color..."
                className="w-full pl-11 pr-10 py-3 border-2 border-slate-200 rounded-xl text-base font-semibold focus:border-red-500 focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <ChevronDown size={18} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Dropdown Menu showing Unique Code + Product Name + Size + Color */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-white rounded-2xl border border-slate-200 shadow-2xl max-h-72 overflow-y-auto divide-y divide-slate-100">
                <div className="p-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                  <span>Available Inventory Products ({matchingItems.length})</span>
                  <span className="text-[10px] text-slate-400 font-normal">Click any item to select</span>
                </div>

                {matchingItems.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    No products match &quot;{searchProduct}&quot;.
                  </div>
                ) : (
                  matchingItems.map(item => {
                    const isSelected = item.barcode.toLowerCase() === barcode.toLowerCase();
                    const unit = normalizeUnit(item.unit);
                    return (
                      <div
                        key={item.barcode}
                        onClick={() => handleSelectProduct(item)}
                        className={`p-3.5 hover:bg-red-50/70 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                          isSelected ? 'bg-red-50 border-l-4 border-red-600' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded shadow-xs">
                              {item.barcode}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">
                              {item.name}
                            </span>
                            {isSelected && (
                              <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                                <Check size={10} /> Selected
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                            {item.size && (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                                Size: {item.size}
                              </span>
                            )}
                            {item.color && (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                                Color: {formatColorLabel(item.color)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-xs font-bold block ${
                              item.stock > 0 ? 'text-green-700' : 'text-red-600'
                            }`}
                          >
                            Stock: {item.stock} {unit}
                          </span>
                          {(() => {
                            const p = getItemSellingPrice(item);
                            return p !== undefined ? (
                              <span className="text-xs font-bold text-blue-700 block mt-0.5">
                                ₹{p} / {unit}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* KGS Dispatch Mode Toggle (500g Packets vs Direct KGS) */}
          {detectedItem && isKgs && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Select Dispatch Mode
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('PACKETS_500G')}
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
                    outKgMode === 'PACKETS_500G'
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Package size={16} />
                  <span>500g Packets</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('DIRECT_KG')}
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
                    outKgMode === 'DIRECT_KG'
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Scale size={16} />
                  <span>Direct KGS</span>
                </button>
              </div>
            </div>
          )}

          {/* Quantity Input with Stepper */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              {isKgs
                ? outKgMode === 'PACKETS_500G'
                  ? 'Number of 500g Packets to Dispatch *'
                  : 'Weight to Dispatch in KGS *'
                : `Dispatch Quantity (${detectedUnit}) *`}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleStep(-1)}
                className="bg-slate-100 hover:bg-slate-200 border-2 border-slate-200 text-slate-800 font-bold w-12 h-[52px] rounded-xl text-xl flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <input
                type="text"
                inputMode={isKgs && outKgMode === 'DIRECT_KG' ? 'decimal' : 'numeric'}
                value={qty}
                onChange={e =>
                  setQty(
                    isKgs && outKgMode === 'DIRECT_KG'
                      ? sanitizeDecimalInput(e.target.value)
                      : e.target.value.replace(/[^\d]/g, '')
                  )
                }
                placeholder={
                  isKgs && outKgMode === 'PACKETS_500G'
                    ? 'e.g. 1, 3, 11'
                    : isKgs
                    ? 'e.g. 2.5'
                    : 'Enter qty'
                }
                className="w-full border-2 border-slate-200 p-3 rounded-xl text-base text-center font-bold text-slate-800 focus:border-red-500 focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => handleStep(1)}
                className="bg-slate-100 hover:bg-slate-200 border-2 border-slate-200 text-slate-800 font-bold w-12 h-[52px] rounded-xl text-xl flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            {/* Quick Preset Selection Chips by Unit */}
            {detectedItem && isKgs && outKgMode === 'PACKETS_500G' && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[1, 2, 3, 5, 10, 11].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQty(String(preset))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      rawNumber === preset
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset} {preset === 1 ? 'Pkt' : 'Pkts'} ({packetsToKg(preset)} kg)
                  </button>
                ))}
              </div>
            )}

            {detectedItem && detectedUnit === 'PAC' && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[1, 2, 3, 5, 10].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQty(String(preset))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      rawNumber === preset
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    -{preset} PAC
                  </button>
                ))}
              </div>
            )}

            {detectedItem && detectedUnit === 'PCS' && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[1, 2, 5, 10, 20].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQty(String(preset))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      rawNumber === preset
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    -{preset} PCS
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* UNIT PRICE INPUT & TOTAL SALE CALCULATION */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <IndianRupee size={15} className="text-blue-600" />
                Selling Price per {detectedUnit} (₹)
              </label>
              {calculatedTotalAmount !== undefined && (
                <span className="text-sm font-extrabold text-blue-800 bg-blue-100/70 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                  Total: ₹{calculatedTotalAmount.toLocaleString()}
                </span>
              )}
            </div>

            <input
              type="text"
              inputMode="decimal"
              value={priceInput}
              onChange={e => setPriceInput(sanitizeDecimalInput(e.target.value))}
              placeholder={
                detectedItem?.price
                  ? `e.g. ${detectedItem.price}`
                  : `Enter unit price (₹) e.g. 250`
              }
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Live Dispatch Preview */}
          {detectedItem && isKgs && outKgMode === 'PACKETS_500G' && rawNumber > 0 && (
            <div className="mt-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-900 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  KGS Logic: <strong>{rawNumber}</strong> packets &times;{' '}
                  <strong>{PACKET_WEIGHT_KG} kg</strong>
                </span>
                <span className="font-extrabold text-red-700 text-base">
                  = -{finalQtyToDeduct} KGS
                </span>
              </div>
              {detectedItem.stock >= finalQtyToDeduct && (
                <p className="text-xs text-red-700">
                  Remaining stock after dispatch:{' '}
                  <strong>{remainingAfterOut} KGS</strong> (
                  {roundQty(remainingAfterOut / PACKET_WEIGHT_KG)} packets)
                </p>
              )}
            </div>
          )}

          {detectedItem && !isKgs && finalQtyToDeduct > 0 && (
            <div className="mt-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-900 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {detectedUnit} Logic: Direct {detectedUnit === 'PAC' ? 'Packet' : 'Piece'} Dispatch
                </span>
                <span className="font-extrabold text-red-700 text-base">
                  -{finalQtyToDeduct} {detectedUnit}
                </span>
              </div>
              {detectedItem.stock >= finalQtyToDeduct && (
                <p className="text-xs text-red-700">
                  Remaining stock after dispatch:{' '}
                  <strong>
                    {remainingAfterOut} {detectedUnit}
                  </strong>
                </p>
              )}
            </div>
          )}

          {detectedItem && detectedItem.stock < finalQtyToDeduct && (
            <p className="text-xs text-red-500 mt-1.5 font-semibold">
              Requested {finalQtyToDeduct} {detectedUnit} exceeds available stock (
              {detectedItem.stock} {detectedUnit}).
            </p>
          )}

          <button
            type="submit"
            disabled={
              isSyncing ||
              !customerName.trim() ||
              !barcode.trim() ||
              !detectedItem ||
              finalQtyToDeduct <= 0 ||
              detectedItem.stock < finalQtyToDeduct
            }
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl w-full flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            <MinusCircle size={22} />
            <span>
              {isSyncing
                ? 'Processing Stock OUT...'
                : isKgs && outKgMode === 'PACKETS_500G'
                ? `Process Stock OUT (-${finalQtyToDeduct} KGS • ${rawNumber} ${rawNumber === 1 ? 'Packet' : 'Packets'}${
                    calculatedTotalAmount !== undefined ? ` • ₹${calculatedTotalAmount}` : ''
                  })`
                : `Process Stock OUT (-${finalQtyToDeduct} ${detectedUnit}${
                    calculatedTotalAmount !== undefined ? ` • ₹${calculatedTotalAmount}` : ''
                  })`}
            </span>
          </button>
        </form>
      </div>

      {showScanner && (
        <QRScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
