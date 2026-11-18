import { useState, useEffect } from 'react';
import { useStore, StockItem } from '../store';
import QRScanner from '../components/QRScanner';
import QRLabelModal from '../components/QRLabelModal';
import { AllowedUnit, normalizeUnit, parseScannedQR } from '../utils/qrHelper';
import { ArrowDownToLine, QrCode, PlusCircle, CheckCircle, Printer } from 'lucide-react';

export default function In() {
  const { items, scanIn, isSyncing } = useStore();
  const [showScanner, setShowScanner] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [qty, setQty] = useState<number>(1);
  const [unit, setUnit] = useState<AllowedUnit>('PCS');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [lastSavedItem, setLastSavedItem] = useState<StockItem | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  // Check if item exists in inventory
  const detectedItem = items.find(
    i => i.barcode.toLowerCase() === barcode.trim().toLowerCase()
  );

  // When detected item changes, auto-populate details
  useEffect(() => {
    if (detectedItem) {
      setName(detectedItem.name);
      setSize(detectedItem.size || '');
      setColor(detectedItem.color || '');
      setUnit(normalizeUnit(detectedItem.unit));
    }
  }, [detectedItem]);

  const handleScanSuccess = (decodedText: string) => {
    setShowScanner(false);
    const parsed = parseScannedQR(decodedText);
    const code = parsed.barcode.trim();
    setBarcode(code);
    setLastScanned(code);

    const existing = items.find(
      i => i.barcode.toLowerCase() === code.toLowerCase()
    );

    if (existing) {
      setName(existing.name);
      setSize(existing.size || '');
      setColor(existing.color || '');
      setUnit(normalizeUnit(existing.unit));
    } else {
      setName(parsed.name || '');
      setSize(parsed.size || '');
      setColor(parsed.color || '');
      setUnit(parsed.unit || 'PCS');
    }
  };

  const handleManualIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!barcode.trim()) {
      alert('Please enter or scan a Unique Product Code.');
      return;
    }

    if (!name.trim()) {
      alert('Product Name is required.');
      return;
    }

    const quantity = Number(qty);
    if (!quantity || quantity <= 0) {
      alert('Please enter a valid quantity (minimum 1).');
      return;
    }

    const result = await scanIn({
      barcode: barcode.trim(),
      name: name.trim(),
      size: size.trim(),
      color: color.trim(),
      qty: quantity,
      unit,
      source: lastScanned === barcode.trim() ? 'SCAN' : 'MANUAL',
    });

    alert(result.message);

    if (result.success) {
      if (result.item) {
        setLastSavedItem(result.item);
      }
      setBarcode('');
      setName('');
      setSize('');
      setColor('');
      setQty(1);
      setUnit('PCS');
      setLastScanned(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-4 pb-12">
      <div className="text-center space-y-2">
        <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
          <ArrowDownToLine size={32} />
        </div>
        <h1 className="text-3xl font-bold text-slate-800">Stock IN (Inward)</h1>
        <p className="text-slate-500 text-sm">
          Scan a QR/Barcode or enter a Product Code manually, then fill in the details and quantity.
        </p>
      </div>

      {/* Quick Print QR Banner for Last Saved Item */}
      {lastSavedItem && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-sm text-emerald-900">
            <p className="font-bold">
              QR Ready: {lastSavedItem.name} ({lastSavedItem.barcode})
            </p>
            <p className="text-xs text-emerald-700">
              Print or download the printable QR label for this product.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowQRModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
          >
            <Printer size={15} />
            <span>View / Print QR Label</span>
          </button>
        </div>
      )}

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        {/* Camera Scan Button */}
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="bg-green-600 hover:bg-green-700 text-white text-base font-bold py-3.5 px-6 rounded-xl w-full flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          <QrCode size={22} />
          <span>Scan QR / Barcode</span>
        </button>

        <div className="flex items-center gap-4 text-slate-400">
          <div className="flex-1 h-px bg-slate-200"></div>
          <span className="text-xs font-bold tracking-wider uppercase text-slate-400">
            Manual Product Code &amp; Details
          </span>
          <div className="flex-1 h-px bg-slate-200"></div>
        </div>

        {/* Existing Item Alert Badge */}
        {detectedItem && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3 text-blue-800 text-sm">
            <CheckCircle className="text-blue-600 shrink-0" size={20} />
            <div>
              <p className="font-semibold">Existing Item Detected: {detectedItem.name}</p>
              <p className="text-xs text-blue-600">
                Current Stock:{' '}
                <span className="font-bold">
                  {detectedItem.stock} {normalizeUnit(detectedItem.unit)}
                </span>
                . The entered quantity will be added to this stock.
              </p>
            </div>
          </div>
        )}

        {/* Main Stock IN Form */}
        <form onSubmit={handleManualIn} className="space-y-4">
          {/* Manual Unique Code / Barcode */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Unique Product Code *
            </label>
            <input
              type="text"
              value={barcode}
              onChange={e => {
                setBarcode(e.target.value);
                setLastScanned(null);
              }}
              placeholder="Enter product code (e.g. PRD-T001)"
              className="w-full border-2 border-slate-200 p-3 rounded-xl text-base font-mono focus:border-green-500 focus:outline-none"
              required
            />
          </div>

          {/* Product Name / Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Product Name / Category *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Tyre, Tube, Rim"
              className="w-full border-2 border-slate-200 p-3 rounded-xl text-base focus:border-green-500 focus:outline-none"
              required
            />
          </div>

          {/* Size and Color (2 columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Size (Optional)
              </label>
              <input
                type="text"
                value={size}
                onChange={e => setSize(e.target.value)}
                placeholder="e.g. 16 inch, 14 inch, M, L"
                className="w-full border-2 border-slate-200 p-3 rounded-xl text-base focus:border-green-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Color (Optional)
              </label>
              <input
                type="text"
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="e.g. Black, Red, Blue"
                className="w-full border-2 border-slate-200 p-3 rounded-xl text-base focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Quantity and Unit (2 columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Quantity (Qty to IN) *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border-2 border-slate-200 p-3 rounded-xl text-base font-bold text-slate-800 focus:border-green-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Unit *
              </label>
              <select
                value={unit}
                onChange={e => setUnit(normalizeUnit(e.target.value))}
                className="w-full border-2 border-slate-200 p-3 rounded-xl text-base bg-white font-semibold focus:border-green-500 focus:outline-none cursor-pointer"
              >
                <option value="PCS">PCS</option>
                <option value="KGS">KGS</option>
                <option value="PAC">PAC</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSyncing}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl w-full flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer mt-2"
          >
            <PlusCircle size={22} />
            <span>
              {isSyncing ? 'Saving to Google Sheet...' : `Submit Stock IN (+${qty} ${unit})`}
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

      {showQRModal && lastSavedItem && (
        <QRLabelModal
          items={[lastSavedItem]}
          onClose={() => setShowQRModal(false)}
          title={`QR Label — ${lastSavedItem.barcode}`}
        />
      )}
    </div>
  );
}
