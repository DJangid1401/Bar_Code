import { useState, useRef, useMemo } from 'react';
import { useStore, StockItem } from '../store';
import QRLabelModal from '../components/QRLabelModal';
import VoiceSearchButton from '../components/VoiceSearchButton';
import { normalizeVoiceQuery } from '../utils/voiceHelper';
import { AllowedUnit, normalizeUnit, roundQty, sanitizeDecimalInput } from '../utils/qrHelper';
import { formatColorLabel } from '../utils/demoSalesData';
import {
  Package,
  Search,
  Upload,
  FileSpreadsheet,
  Download,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  QrCode,
  Printer,
  IndianRupee,
  RotateCcw,
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Feature toggle: set to true in the future to show Sample Excel & Upload Excel/CSV buttons again
const SHOW_EXCEL_UPLOAD = false;

export default function Stock() {
  const { items, currentUser, bulkStockIn, updateItem, deleteItem, isLoading, isSyncing } =
    useStore();
  const isAdmin = currentUser?.role === 'Admin';
  const [search, setSearch] = useState('');
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel / CSV Upload Preview State
  type ParsedEntry = {
    barcode: string;
    name: string;
    size: string;
    color: string;
    qty: number;
    unit: AllowedUnit;
  };

  const [previewItems, setPreviewItems] = useState<ParsedEntry[]>([]);
  const [skippedMissingCodeCount, setSkippedMissingCodeCount] = useState<number>(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [fileName, setFileName] = useState('');

  // QR Label Modal State
  const [qrModalItems, setQrModalItems] = useState<StockItem[] | null>(null);
  const [qrModalTitle, setQrModalTitle] = useState<string>('Printable QR Labels');

  // Row selection for batch QR printing
  const [selectedBarcodes, setSelectedBarcodes] = useState<string[]>([]);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState<string>('0');
  const [editUnit, setEditUnit] = useState<AllowedUnit>('PCS');

  // Delete Modal State
  const [deletingItem, setDeletingItem] = useState<StockItem | null>(null);

  // Filter States for Stock list & QR
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [selectedSize, setSelectedSize] = useState<string>('ALL');
  const [selectedColor, setSelectedColor] = useState<string>('ALL');
  const [stockStatus, setStockStatus] = useState<'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');

  // Dynamic filter dropdown options
  const productOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const clean = (item.name || '').trim();
      if (clean) set.add(clean);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const sizeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (
        selectedProduct !== 'ALL' &&
        item.name.trim().toLowerCase() !== selectedProduct.toLowerCase()
      ) {
        continue;
      }
      const clean = (item.size || '').trim();
      if (clean) set.add(clean);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, selectedProduct]);

  const colorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (
        selectedProduct !== 'ALL' &&
        item.name.trim().toLowerCase() !== selectedProduct.toLowerCase()
      ) {
        continue;
      }
      const clean = (item.color || '').trim();
      if (clean) set.add(clean);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, selectedProduct]);

  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const u = normalizeUnit(item.unit);
      if (u) set.add(u);
    }
    return Array.from(set).sort();
  }, [items]);

  // Combined Multi-Criteria Filter (Search + Product + Size + Color + Stock Status + Unit)
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter(i => {
      // 1. Product Filter
      if (
        selectedProduct !== 'ALL' &&
        i.name.trim().toLowerCase() !== selectedProduct.toLowerCase()
      ) {
        return false;
      }

      // 2. Size Filter
      if (
        selectedSize !== 'ALL' &&
        (i.size || '').trim().toLowerCase() !== selectedSize.toLowerCase()
      ) {
        return false;
      }

      // 3. Color Filter
      if (
        selectedColor !== 'ALL' &&
        (i.color || '').trim().toLowerCase() !== selectedColor.toLowerCase()
      ) {
        return false;
      }

      // 4. Stock Availability Filter
      if (stockStatus === 'IN_STOCK' && i.stock <= 0) return false;
      if (stockStatus === 'OUT_OF_STOCK' && i.stock > 0) return false;

      // 5. Unit Filter
      if (selectedUnit !== 'ALL' && normalizeUnit(i.unit) !== selectedUnit) {
        return false;
      }

      // 6. Text / Voice Search Query
      if (q) {
        const colorFormatted = formatColorLabel(i.color).toLowerCase();
        const matches =
          i.name.toLowerCase().includes(q) ||
          i.barcode.toLowerCase().includes(q) ||
          (i.size && i.size.toLowerCase().includes(q)) ||
          (i.color && i.color.toLowerCase().includes(q)) ||
          colorFormatted.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [items, search, selectedProduct, selectedSize, selectedColor, stockStatus, selectedUnit]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    selectedProduct !== 'ALL' ||
    selectedSize !== 'ALL' ||
    selectedColor !== 'ALL' ||
    stockStatus !== 'ALL' ||
    selectedUnit !== 'ALL';

  const handleResetFilters = () => {
    setSearch('');
    setSelectedProduct('ALL');
    setSelectedSize('ALL');
    setSelectedColor('ALL');
    setStockStatus('ALL');
    setSelectedUnit('ALL');
  };

  const totalStockCount = roundQty(items.reduce((acc, curr) => acc + curr.stock, 0));

  // Selection helpers
  const toggleSelect = (barcode: string) => {
    setSelectedBarcodes(prev =>
      prev.includes(barcode) ? prev.filter(b => b !== barcode) : [...prev, barcode]
    );
  };

  const allFilteredSelected =
    filteredItems.length > 0 &&
    filteredItems.every(i => selectedBarcodes.includes(i.barcode));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedBarcodes([]);
    } else {
      setSelectedBarcodes(filteredItems.map(i => i.barcode));
    }
  };

  const handleOpenBatchQR = () => {
    const targetItems =
      selectedBarcodes.length > 0
        ? items.filter(i => selectedBarcodes.includes(i.barcode))
        : filteredItems;

    if (targetItems.length === 0) {
      alert('No products available to print.');
      return;
    }

    const title =
      selectedBarcodes.length > 0
        ? `Selected QR Labels (${targetItems.length} Products)`
        : hasActiveFilters
        ? `Filtered QR Labels (${targetItems.length} of ${items.length} Products)`
        : `All Product QR Labels (${targetItems.length} Products)`;

    setQrModalTitle(title);
    setQrModalItems(targetItems);
  };

  // Download Sample Template (Manual Unique Code + PCS / KGS / PAC)
  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Unique Code': 'PRD-T001',
        'Product Name': 'Tyre',
        Size: '16 inch',
        Color: 'Black',
        Qty: 50,
        Unit: 'PCS',
      },
      {
        'Unique Code': 'PRD-T002',
        'Product Name': 'Tyre',
        Size: '14 inch',
        Color: 'Red',
        Qty: 25,
        Unit: 'PAC',
      },
      {
        'Unique Code': 'PRD-R001',
        'Product Name': 'Rubber Compound',
        Size: 'Standard',
        Color: 'Black',
        Qty: 120,
        Unit: 'KGS',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock_IN_Template');
    XLSX.writeFile(wb, 'stock_in_sample_template.xlsx');
  };

  // Handle Excel / CSV File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
        });

        if (!rows || rows.length === 0) {
          alert('The Excel / CSV file is empty or contains no data rows.');
          return;
        }

        const parsed: ParsedEntry[] = [];
        let missingCodeCount = 0;

        for (const row of rows) {
          const findVal = (keywords: string[]) => {
            const key = Object.keys(row).find(k =>
              keywords.some(kw => k.trim().toLowerCase().includes(kw))
            );
            return key ? String(row[key]).trim() : '';
          };

          const barcode = findVal(['unique code', 'code', 'barcode', 'sku', 'bar code']);
          const name = findVal(['product name', 'name', 'item', 'product', 'title']);
          const size = findVal(['size']);
          const color = findVal(['color', 'colour']);
          const qtyStr = findVal(['qty', 'quantity', 'stock', 'count', 'units']);
          const unitRaw = findVal(['unit', 'uom']);

          if (!name && !barcode) continue;

          if (!barcode) {
            missingCodeCount++;
            continue;
          }

          if (!name) continue;

          const parsedQty = roundQty(parseFloat(qtyStr));
          const qty = parsedQty > 0 ? parsedQty : 1;
          const unit = normalizeUnit(unitRaw);

          parsed.push({
            barcode,
            name,
            size,
            color,
            qty,
            unit,
          });
        }

        if (parsed.length === 0) {
          alert(
            missingCodeCount > 0
              ? `${missingCodeCount} row(s) are missing a Unique Code. Please enter a manual Unique Code (e.g. PRD-T001) in your Excel sheet.`
              : 'No valid products detected in the file. Expected columns: Unique Code, Product Name, Size, Color, Qty, Unit (PCS / KGS / PAC).'
          );
          return;
        }

        setPreviewItems(parsed);
        setSkippedMissingCodeCount(missingCodeCount);
        setShowPreviewModal(true);
      } catch (err: unknown) {
        console.error('File parsing error:', err);
        const message = err instanceof Error ? err.message : String(err);
        alert(`Error reading file: ${message}`);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Confirm and Execute Bulk Import -> Automatically Open Printable QR Labels
  const handleConfirmImport = async () => {
    if (previewItems.length === 0 || isSyncing) return;

    const result = await bulkStockIn(previewItems);
    if (result.count === 0) {
      alert(result.message);
      return;
    }

    setShowPreviewModal(false);
    setPreviewItems([]);
    setSkippedMissingCodeCount(0);
    setFileName('');

    if (result.importedItems.length > 0) {
      setQrModalTitle(
        `Auto-Generated QR Labels (${result.importedItems.length} Imported Items)`
      );
      setQrModalItems(result.importedItems);
    } else {
      alert(result.message);
    }
  };

  // Open Edit Modal
  const handleStartEdit = (item: StockItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditSize(item.size || '');
    setEditColor(item.color || '');
    setEditPrice(item.price !== undefined && item.price !== null ? String(item.price) : '');
    setEditStock(String(item.stock));
    setEditUnit(normalizeUnit(item.unit));
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || isSyncing) return;

    if (!editName.trim()) {
      alert('Product Name cannot be empty.');
      return;
    }

    const parsedStock = roundQty(parseFloat(editStock));
    if (isNaN(parsedStock) || parsedStock < 0) {
      alert('Please enter a valid stock quantity (0 or more).');
      return;
    }

    const parsedPrice =
      editPrice.trim() !== '' && !isNaN(parseFloat(editPrice)) && parseFloat(editPrice) >= 0
        ? roundQty(parseFloat(editPrice))
        : undefined;

    const result = await updateItem(editingItem.barcode, {
      name: editName.trim(),
      size: editSize.trim(),
      color: editColor.trim(),
      price: parsedPrice,
      stock: Math.max(0, parsedStock),
      unit: editUnit,
    });

    alert(result.message);
    if (result.success) {
      setEditingItem(null);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingItem || isSyncing) return;
    const result = await deleteItem(deletingItem.barcode);
    if (result.success) {
      setSelectedBarcodes(prev => prev.filter(b => b !== deletingItem.barcode));
    }
    alert(result.message);
    setDeletingItem(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="text-blue-600" size={30} />
            Full Stock List
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Print QR Labels Button */}
          <button
            type="button"
            onClick={handleOpenBatchQR}
            disabled={filteredItems.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            title="View & Print QR Labels"
          >
            <Printer size={16} />
            <span>
              {selectedBarcodes.length > 0
                ? `Print Selected QR (${selectedBarcodes.length})`
                : hasActiveFilters
                ? `Print Filtered QR (${filteredItems.length})`
                : `Print All QR (${items.length})`}
            </span>
          </button>

          {SHOW_EXCEL_UPLOAD && (
            <>
              {/* Download Sample Template */}
              <button
                type="button"
                onClick={handleDownloadSample}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 transition-colors cursor-pointer"
                title="Download sample Excel template"
              >
                <Download size={16} />
                <span>Sample Excel</span>
              </button>

              {/* Upload Excel / CSV Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
                id="excel-file-upload"
              />
              <label
                htmlFor="excel-file-upload"
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
              >
                <Upload size={17} />
                <span>Upload Excel / CSV (Stock IN)</span>
              </label>
            </>
          )}

          {/* Total Units Badge */}
          <div className="bg-blue-50 border border-blue-200 px-4 py-2.5 rounded-xl text-blue-900 font-bold text-sm">
            Total: <span className="text-blue-600 text-base">{totalStockCount}</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 text-slate-400" size={20} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Product Name, Unique Code, Size, or Color..."
            className={`w-full pl-11 pr-20 py-2.5 border-2 rounded-xl focus:outline-none text-base transition-all ${
              isVoiceListening
                ? 'border-blue-500 ring-4 ring-blue-100 bg-blue-50/20'
                : 'border-slate-200 focus:border-blue-500'
            }`}
          />
          <div className="absolute right-2 top-1.5 flex items-center gap-1">
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
            <VoiceSearchButton
              size="sm"
              buttonTitle="Voice search table (Bol kar search karein)"
              showLangToggle={true}
              onListeningStateChange={setIsVoiceListening}
              onTranscript={spoken => {
                const norm = normalizeVoiceQuery(spoken);
                setSearch(norm);
              }}
            />
          </div>
        </div>
        {isVoiceListening && (
          <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-700 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping shrink-0" />
            <span>Listening... Speak product name, code, size, or color (Bol sakte hain...)</span>
          </div>
        )}

        {/* Multi-Criteria Filter Controls Toolbar */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5 text-xs">
          {/* Product Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="font-bold text-slate-500 uppercase text-[10px]">Product:</span>
            <select
              value={selectedProduct}
              onChange={e => {
                setSelectedProduct(e.target.value);
                setSelectedSize('ALL');
                setSelectedColor('ALL');
              }}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Products ({productOptions.length})</option>
              {productOptions.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Size Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="font-bold text-slate-500 uppercase text-[10px]">Size:</span>
            <select
              value={selectedSize}
              onChange={e => setSelectedSize(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1 max-w-[170px]"
            >
              <option value="ALL">All Sizes ({sizeOptions.length})</option>
              {sizeOptions.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Color Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="font-bold text-slate-500 uppercase text-[10px]">Color:</span>
            <select
              value={selectedColor}
              onChange={e => setSelectedColor(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1 max-w-[150px]"
            >
              <option value="ALL">All Colors ({colorOptions.length})</option>
              {colorOptions.map(c => (
                <option key={c} value={c}>
                  {formatColorLabel(c)}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="font-bold text-slate-500 uppercase text-[10px]">Stock:</span>
            <select
              value={stockStatus}
              onChange={e => setStockStatus(e.target.value as 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK')}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Stock</option>
              <option value="IN_STOCK">In Stock (&gt; 0)</option>
              <option value="OUT_OF_STOCK">Out of Stock (= 0)</option>
            </select>
          </div>

          {/* Unit Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="font-bold text-slate-500 uppercase text-[10px]">Unit:</span>
            <select
              value={selectedUnit}
              onChange={e => setSelectedUnit(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Units</option>
              {unitOptions.map(u => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Count & Reset */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-slate-500 font-medium text-xs">
              Showing <strong className="text-slate-900 font-bold">{filteredItems.length}</strong> of{' '}
              {items.length} products
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[780px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <th className="p-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                    title="Select all for QR print"
                  />
                </th>
                <th className="p-4">Product Name</th>
                <th className="p-4">Unique Code</th>
                <th className="p-4">Size</th>
                <th className="p-4">Color</th>
                <th className="p-4 text-right">Price (₹)</th>
                <th className="p-4 text-right">Current Stock</th>
                <th className="p-4 text-center">{isAdmin ? 'QR & Actions' : 'QR'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredItems.map(item => {
                const unit = normalizeUnit(item.unit);
                const isSelected = selectedBarcodes.includes(item.barcode);
                return (
                  <tr
                    key={item.barcode}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isSelected ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.barcode)}
                        className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                      />
                    </td>
                    <td className="p-4 font-bold text-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shrink-0">
                          <Package size={18} />
                        </div>
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-slate-600 font-medium">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md text-xs font-bold">
                        {item.barcode}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {item.size ? (
                        <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-xs font-semibold">
                          {item.size}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600">
                      {item.color ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block"></span>
                          {item.color}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {item.price !== undefined && item.price !== null ? (
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-xs">
                          ₹{item.price}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-normal">—</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span
                        className={`inline-block px-3 py-1 rounded-full font-bold text-xs ${
                          item.stock > 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.stock} {unit}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setQrModalTitle(`QR Label — ${item.barcode}`);
                            setQrModalItems([item]);
                          }}
                          className="text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-xs font-bold border border-indigo-200"
                          title="Generate & Print QR Code"
                        >
                          <QrCode size={15} />
                          <span>QR</span>
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(item)}
                              className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Edit Item"
                            >
                              <Edit2 size={17} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingItem(item)}
                              className="text-slate-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 size={17} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-16 text-slate-400 space-y-3">
            <Package size={40} className="mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600">
              {isLoading ? 'Loading stock...' : 'No items found.'}
            </p>
            {!isLoading && (
              <p className="text-xs text-slate-400">
                Add products from the Stock IN page or upload an Excel / CSV file above.
              </p>
            )}
          </div>
        )}
      </div>

      {/* --- MODAL 1: EXCEL / CSV PREVIEW MODAL --- */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="text-green-600" size={24} />
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Excel / CSV Import Preview
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{fileName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 text-sm text-green-900 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  Valid Items Ready for Import: {previewItems.length}
                </span>
                <span className="text-xs text-green-700 font-medium">
                  Printable QR labels will be automatically generated after import.
                </span>
              </div>

              {skippedMissingCodeCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-600 shrink-0" />
                  <span>
                    <strong>{skippedMissingCodeCount} row(s)</strong> skipped because the manual{' '}
                    <strong>Unique Code</strong> was blank.
                  </span>
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-bold">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Unique Code</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">Color</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {previewItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">
                            {item.barcode}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-800">{item.name}</td>
                        <td className="p-3 text-slate-600">{item.size || '-'}</td>
                        <td className="p-3 text-slate-600">{item.color || '-'}</td>
                        <td className="p-3 text-right font-bold text-green-700">
                          +{item.qty}
                        </td>
                        <td className="p-3 text-slate-600 font-bold">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isSyncing}
                className="px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold transition-colors cursor-pointer shadow-md text-sm flex items-center gap-2"
              >
                <Check size={18} />
                <span>
                  {isSyncing
                    ? 'Importing items...'
                    : `Confirm, Import & Generate QR (${previewItems.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: EDIT ITEM MODAL --- */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Edit2 className="text-blue-600" size={20} />
                <h3 className="text-lg font-bold text-slate-800">Edit Product Details</h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Unique Code (Permanent)
                </label>
                <input
                  type="text"
                  value={editingItem.barcode}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 p-2.5 rounded-xl font-mono text-sm text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Product Name / Category *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-base focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Size
                  </label>
                  <input
                    type="text"
                    value={editSize}
                    onChange={e => setEditSize(e.target.value)}
                    placeholder="e.g. 16 inch, M, L"
                    className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-base focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    placeholder="e.g. Black, Red"
                    className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-base focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Price (₹ / Unit)
                  </label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-3.5 text-slate-400" size={15} />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editPrice}
                      onChange={e => setEditPrice(sanitizeDecimalInput(e.target.value))}
                      placeholder="e.g. 250"
                      className="w-full border-2 border-slate-200 pl-8 pr-3 py-2.5 rounded-xl text-base font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Current Stock Quantity *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editStock}
                    onChange={e => setEditStock(sanitizeDecimalInput(e.target.value))}
                    className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-base font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Unit *
                  </label>
                  <select
                    value={editUnit}
                    onChange={e => setEditUnit(normalizeUnit(e.target.value))}
                    className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-base bg-white font-semibold focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="PCS">PCS</option>
                    <option value="KGS">KGS</option>
                    <option value="PAC">PAC</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold transition-colors cursor-pointer shadow-md text-sm"
                >
                  {isSyncing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: DELETE CONFIRMATION MODAL --- */}
      {deletingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertCircle size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Delete Product?</h3>
            </div>
            <p className="text-slate-600 text-sm">
              Are you sure you want to delete{' '}
              <strong className="text-slate-900">"{deletingItem.name}"</strong> (Code:{' '}
              <span className="font-mono text-xs">{deletingItem.barcode}</span>) from inventory?
            </p>
            <p className="text-xs text-red-500 font-semibold bg-red-50 p-2.5 rounded-lg border border-red-200">
              Its current stock ({deletingItem.stock} {normalizeUnit(deletingItem.unit)}) will also
              be removed.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSyncing}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold transition-colors cursor-pointer shadow-md text-sm"
              >
                {isSyncing ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: PRINTABLE QR LABELS MODAL --- */}
      {qrModalItems && (
        <QRLabelModal
          items={qrModalItems}
          onClose={() => setQrModalItems(null)}
          title={qrModalTitle}
        />
      )}
    </div>
  );
}
