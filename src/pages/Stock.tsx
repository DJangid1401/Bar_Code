import { useState, useRef } from 'react';
import { useStore, StockItem, generateUniqueCode } from '../store';
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
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Stock() {
  const { items, bulkStockIn, updateItem, deleteItem } = useStore();
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel / CSV Upload Preview State
  type ParsedEntry = {
    barcode: string;
    name: string;
    size: string;
    color: string;
    qty: number;
    unit: string;
    isAutoCode?: boolean;
  };

  const [previewItems, setPreviewItems] = useState<ParsedEntry[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [fileName, setFileName] = useState('');

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editStock, setEditStock] = useState<number>(0);
  const [editUnit, setEditUnit] = useState('Pcs');

  // Delete Modal State
  const [deletingItem, setDeletingItem] = useState<StockItem | null>(null);

  // Search filter
  const filteredItems = items.filter(i => {
    const query = search.toLowerCase();
    return (
      i.name.toLowerCase().includes(query) ||
      i.barcode.toLowerCase().includes(query) ||
      (i.size && i.size.toLowerCase().includes(query)) ||
      (i.color && i.color.toLowerCase().includes(query))
    );
  });

  const totalStockCount = items.reduce((acc, curr) => acc + curr.stock, 0);

  // Download Sample Template
  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Unique Code': 'PRD-A101',
        'Product Name': 'Cotton T-Shirt',
        Size: 'M',
        Color: 'Black',
        Qty: 50,
        Unit: 'Pcs',
      },
      {
        'Unique Code': '', // Leave blank to show auto-generation
        'Product Name': 'Leather Formal Shoes',
        Size: '42',
        Color: 'Brown',
        Qty: 20,
        Unit: 'Pair',
      },
      {
        'Unique Code': 'PRD-B202',
        'Product Name': 'Stainless Steel Bottle',
        Size: '1000ml',
        Color: 'Silver',
        Qty: 100,
        Unit: 'Pcs',
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
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rows || rows.length === 0) {
          alert('Excel / CSV file empty hai ya data rows nahi mili!');
          return;
        }

        const existingCodes = items.map(i => i.barcode);
        const parsed: ParsedEntry[] = [];

        for (const row of rows) {
          // Flexible key lookup
          const findVal = (keywords: string[]) => {
            const key = Object.keys(row).find(k =>
              keywords.some(kw => k.trim().toLowerCase().includes(kw))
            );
            return key ? String(row[key]).trim() : '';
          };

          let barcode = findVal(['unique code', 'code', 'barcode', 'sku', 'bar code']);
          const name = findVal(['product name', 'name', 'item', 'product', 'title']);
          const size = findVal(['size']);
          const color = findVal(['color', 'colour']);
          const qtyStr = findVal(['qty', 'quantity', 'stock', 'count', 'units']);
          const unit = findVal(['unit', 'uom']) || 'Pcs';

          if (!name) continue; // Skip empty rows

          let isAutoCode = false;
          if (!barcode) {
            barcode = generateUniqueCode([...existingCodes, ...parsed.map(p => p.barcode)]);
            isAutoCode = true;
          }

          const qty = Math.max(1, parseInt(qtyStr) || 1);

          parsed.push({
            barcode,
            name,
            size,
            color,
            qty,
            unit,
            isAutoCode,
          });
        }

        if (parsed.length === 0) {
          alert(
            'File se koi valid products detect nahi hue. Kripya column names check karein (Unique Code, Product Name, Size, Color, Qty, Unit).'
          );
          return;
        }

        setPreviewItems(parsed);
        setShowPreviewModal(true);
      } catch (err: any) {
        console.error('File parsing error:', err);
        alert(`File read karne mein error aayi: ${err?.message || err}`);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Confirm and Execute Bulk Import
  const handleConfirmImport = () => {
    if (previewItems.length === 0) return;

    const result = bulkStockIn(previewItems);
    alert(result.message);
    setShowPreviewModal(false);
    setPreviewItems([]);
    setFileName('');
  };

  // Open Edit Modal
  const handleStartEdit = (item: StockItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditSize(item.size || '');
    setEditColor(item.color || '');
    setEditStock(item.stock);
    setEditUnit(item.unit || 'Pcs');
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editName.trim()) {
      alert('Product Name empty nahi ho sakta!');
      return;
    }

    const result = updateItem(editingItem.barcode, {
      name: editName.trim(),
      size: editSize.trim(),
      color: editColor.trim(),
      stock: Math.max(0, editStock),
      unit: editUnit.trim() || 'Pcs',
    });

    alert(result.message);
    if (result.success) {
      setEditingItem(null);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    const result = deleteItem(deletingItem.barcode);
    alert(result.message);
    setDeletingItem(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="text-blue-600" size={30} />
            Full Stock List
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Godown inventory, Excel/CSV bulk import, and live stock editing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Download Sample Template */}
          <button
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

          {/* Total Units Badge */}
          <div className="bg-blue-50 border border-blue-200 px-4 py-2.5 rounded-xl text-blue-900 font-bold text-sm">
            Total Units: <span className="text-blue-600 text-base">{totalStockCount}</span>
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
            placeholder="Search by Product Name, Unique Code / Barcode, Size, or Color..."
            className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-base"
          />
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <th className="p-4">Product Name</th>
                <th className="p-4">Unique Code / SKU</th>
                <th className="p-4">Size</th>
                <th className="p-4">Color</th>
                <th className="p-4 text-right">Current Stock</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredItems.map(item => (
                <tr key={item.barcode} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-bold text-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shrink-0">
                        <Package size={18} />
                      </div>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-slate-600 font-medium">
                    <span className="bg-slate-100 px-2.5 py-1 rounded-md text-xs">
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
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
                        {item.color}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
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
                      {item.stock} {item.unit || 'Pcs'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleStartEdit(item)}
                        className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                        title="Edit Item"
                      >
                        <Edit2 size={17} />
                      </button>
                      <button
                        onClick={() => setDeletingItem(item)}
                        className="text-slate-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                        title="Delete Item"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-16 text-slate-400 space-y-3">
            <Package size={40} className="mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600">Koi item nahi mila.</p>
            <p className="text-xs text-slate-400">
              Stock IN page se item add karein ya upar se Excel / CSV file upload karein.
            </p>
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
              <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 text-sm text-green-900 flex items-center justify-between">
                <span className="font-semibold">
                  Total Items Detected: {previewItems.length}
                </span>
                <span className="text-xs text-green-700">
                  Yeh items Stock IN ke roop mein inventory mein add/update honge.
                </span>
              </div>

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
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-semibold">
                            {item.barcode}
                          </span>
                          {item.isAutoCode && (
                            <span className="ml-1 text-[10px] text-blue-600 font-sans font-bold">
                              (Auto)
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-800">{item.name}</td>
                        <td className="p-3 text-slate-600">{item.size || '-'}</td>
                        <td className="p-3 text-slate-600">{item.color || '-'}</td>
                        <td className="p-3 text-right font-bold text-green-700">
                          +{item.qty}
                        </td>
                        <td className="p-3 text-slate-600">{item.unit}</td>
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
                className="px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-colors cursor-pointer shadow-md text-sm flex items-center gap-2"
              >
                <Check size={18} />
                <span>Confirm & Import ({previewItems.length} Items)</span>
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
                  Unique Code / Barcode (Permanent)
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
                  Product Name *
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
                    placeholder="e.g. M, L, XL, 42"
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
                    placeholder="e.g. Blue, Red"
                    className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-base focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Current Stock Quantity *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editStock}
                    onChange={e => setEditStock(Math.max(0, parseInt(e.target.value) || 0))}
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
                    onChange={e => setEditUnit(e.target.value)}
                    className="w-full border-2 border-slate-200 p-2.5 rounded-xl text-base bg-white focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Box">Box</option>
                    <option value="Kg">Kg</option>
                    <option value="Mtr">Mtr</option>
                    <option value="Nos">Nos</option>
                    <option value="Set">Set</option>
                    <option value="Pair">Pair</option>
                    <option value="Ltr">Ltr</option>
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
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors cursor-pointer shadow-md text-sm"
                >
                  Save Changes
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
              Kya aap sure hain ki aap{' '}
              <strong className="text-slate-900">"{deletingItem.name}"</strong> (Code:{' '}
              <span className="font-mono text-xs">{deletingItem.barcode}</span>) ko inventory se
              delete karna chahte hain?
            </p>
            <p className="text-xs text-red-500 font-semibold bg-red-50 p-2.5 rounded-lg border border-red-200">
              Iska current stock ({deletingItem.stock} {deletingItem.unit}) bhi remove ho jayega.
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
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors cursor-pointer shadow-md text-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
