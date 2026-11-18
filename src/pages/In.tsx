import { useState, useEffect } from 'react';
import { useStore, generateUniqueCode } from '../store';
import QRScanner from '../components/QRScanner';
import { ArrowDownToLine, QrCode, PlusCircle, Sparkles, CheckCircle } from 'lucide-react';

export default function In() {
  const { items, scanIn } = useStore();
  const [showScanner, setShowScanner] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [qty, setQty] = useState<number>(1);
  const [unit, setUnit] = useState('Pcs');
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  // Auto-generate code on mount if empty
  useEffect(() => {
    if (!barcode) {
      handleGenerateCode();
    }
  }, []);

  const handleGenerateCode = () => {
    const existingCodes = items.map(i => i.barcode);
    const newCode = generateUniqueCode(existingCodes);
    setBarcode(newCode);
    setLastScanned(null);
  };

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
      setUnit(detectedItem.unit || 'Pcs');
    }
  }, [detectedItem]);

  const handleScanSuccess = (scannedCode: string) => {
    setShowScanner(false);
    const code = scannedCode.trim();
    setBarcode(code);
    setLastScanned(code);

    const existing = items.find(
      i => i.barcode.toLowerCase() === code.toLowerCase()
    );

    if (existing) {
      setName(existing.name);
      setSize(existing.size || '');
      setColor(existing.color || '');
      setUnit(existing.unit || 'Pcs');
    } else {
      // Clear previous name if it was prefilled
      setName('');
      setSize('');
      setColor('');
    }
  };

  const handleManualIn = (e: React.FormEvent) => {
    e.preventDefault();

    if (!barcode.trim()) {
      alert('Unique Code / Barcode dalna zaroori hai!');
      return;
    }

    if (!name.trim()) {
      alert('Product Name dalna zaroori hai!');
      return;
    }

    const quantity = Number(qty);
    if (!quantity || quantity <= 0) {
      alert('Valid Quantity enter karein (kam se kam 1)!');
      return;
    }

    const result = scanIn({
      barcode: barcode.trim(),
      name: name.trim(),
      size: size.trim(),
      color: color.trim(),
      qty: quantity,
      unit: unit.trim() || 'Pcs',
      source: lastScanned === barcode.trim() ? 'SCAN' : 'MANUAL',
    });

    alert(result.message);

    if (result.success) {
      // Reset form with a fresh unique code for the next entry
      setName('');
      setSize('');
      setColor('');
      setQty(1);
      setLastScanned(null);
      handleGenerateCode();
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
          Barcode scan karein ya auto-generate karein, details & quantity enter karke inward submit karein.
        </p>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        {/* Camera Scan Button */}
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="bg-green-600 hover:bg-green-700 text-white text-base font-bold py-3.5 px-6 rounded-xl w-full flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          <QrCode size={22} />
          <span>1 Scan Barcode / QR Code</span>
        </button>

        <div className="flex items-center gap-4 text-slate-400">
          <div className="flex-1 h-px bg-slate-200"></div>
          <span className="text-xs font-bold tracking-wider uppercase text-slate-400">
            Product Details & Quantity
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
                Current Stock: <span className="font-bold">{detectedItem.stock} {detectedItem.unit}</span>. Entered quantity will be added to this stock.
              </p>
            </div>
          </div>
        )}

        {/* Main Stock IN Form */}
        <form onSubmit={handleManualIn} className="space-y-4">
          {/* Unique Code / Barcode */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-semibold text-slate-700">
                Unique Code / Barcode *
              </label>
              <button
                type="button"
                onClick={handleGenerateCode}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline cursor-pointer"
                title="Generate new unique code"
              >
                <Sparkles size={13} /> Auto-Generate Code
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={barcode}
                onChange={e => {
                  setBarcode(e.target.value);
                  setLastScanned(null);
                }}
                placeholder="e.g. PRD-A8F291 ya scan karein"
                className="w-full border-2 border-slate-200 p-3 rounded-xl text-base font-mono focus:border-green-500 focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={handleGenerateCode}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-3.5 rounded-xl flex items-center gap-1 text-sm font-semibold shrink-0 transition-colors"
                title="Regenerate unique code"
              >
                <Sparkles size={16} /> New Code
              </button>
            </div>
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Product Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Cotton T-Shirt, Steel Pipe, LED Bulb"
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
                placeholder="e.g. M, L, XL, 42, 10mm"
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
                placeholder="e.g. Blue, Red, Black, White"
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
                onChange={e => setUnit(e.target.value)}
                className="w-full border-2 border-slate-200 p-3 rounded-xl text-base bg-white focus:border-green-500 focus:outline-none cursor-pointer"
              >
                <option value="Pcs">Pcs (Pieces)</option>
                <option value="Box">Box</option>
                <option value="Kg">Kg (Kilograms)</option>
                <option value="Mtr">Mtr (Meters)</option>
                <option value="Nos">Nos (Numbers)</option>
                <option value="Set">Set</option>
                <option value="Pair">Pair</option>
                <option value="Ltr">Ltr (Liters)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-6 rounded-xl w-full flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer mt-2"
          >
            <PlusCircle size={22} />
            <span>Submit Stock IN (+{qty} {unit})</span>
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
