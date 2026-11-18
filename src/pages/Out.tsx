import { useState } from 'react';
import { useStore } from '../store';
import QRScanner from '../components/QRScanner';
import { normalizeUnit, parseScannedQR } from '../utils/qrHelper';
import { ArrowUpFromLine, QrCode, MinusCircle, AlertCircle, Package } from 'lucide-react';

export default function Out() {
  const { items, scanOut } = useStore();
  const [showScanner, setShowScanner] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [qty, setQty] = useState<number>(1);

  const detectedItem = items.find(
    i => i.barcode.toLowerCase() === barcode.trim().toLowerCase()
  );

  const detectedUnit = detectedItem ? normalizeUnit(detectedItem.unit) : 'PCS';

  const handleScanSuccess = (decodedText: string) => {
    setShowScanner(false);
    const parsed = parseScannedQR(decodedText);
    setBarcode(parsed.barcode.trim());
  };

  const handleManualOut = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode) {
      alert('Stock OUT karne ke liye product code dalna zaroori hai!');
      return;
    }

    if (!detectedItem) {
      alert('Error: Ye item system mein registered nahi hai!');
      return;
    }

    const quantity = Number(qty);
    if (!quantity || quantity <= 0) {
      alert('Valid quantity enter karein (kam se kam 1)!');
      return;
    }

    if (detectedItem.stock < quantity) {
      alert(
        `Error: Stock kam hai! Current stock sirf ${detectedItem.stock} ${detectedUnit} hai.`
      );
      return;
    }

    const result = scanOut({
      barcode: trimmedBarcode,
      qty: quantity,
    });

    alert(result.message);
    if (result.success) {
      setBarcode('');
      setQty(1);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-4 pb-12">
      <div className="text-center space-y-2">
        <div className="bg-red-100 text-red-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
          <ArrowUpFromLine size={32} />
        </div>
        <h1 className="text-3xl font-bold text-slate-800">Stock OUT (Dispatch / Sale)</h1>
        <p className="text-slate-500 text-sm">
          Product QR scan karein ya manual product code enter karke quantity dispatch karein.
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
          <span>1 Scan QR / Barcode</span>
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
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <Package size={20} className="text-blue-600" />
                  {detectedItem.name}
                </p>
                <p className="text-xs font-mono text-slate-500 mt-0.5">
                  Code: {detectedItem.barcode}
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
                  Color: <strong>{detectedItem.color}</strong>
                </span>
              )}
              <span>
                Unit: <strong>{detectedUnit}</strong>
              </span>
            </div>
          </div>
        ) : barcode.trim() ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <span>Ye product code system mein register nahi hai. Pehle Stock IN karein.</span>
          </div>
        ) : null}

        {/* Dispatch Form */}
        <form onSubmit={handleManualOut} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Unique Product Code *
            </label>
            <input
              type="text"
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              placeholder="QR scan karein ya code type karein (e.g. PRD-T001)"
              className="w-full border-2 border-slate-200 p-3 rounded-xl text-base font-mono focus:border-red-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Dispatch Quantity (Qty) *
            </label>
            <input
              type="number"
              min="1"
              max={detectedItem ? detectedItem.stock : undefined}
              step="1"
              value={qty}
              onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border-2 border-slate-200 p-3 rounded-xl text-base font-bold text-slate-800 focus:border-red-500 focus:outline-none"
              required
            />
            {detectedItem && detectedItem.stock < qty && (
              <p className="text-xs text-red-500 mt-1">
                Requested quantity available stock ({detectedItem.stock} {detectedUnit}) se zyada hai!
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!barcode.trim() || !detectedItem || detectedItem.stock < qty}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl w-full flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            <MinusCircle size={22} />
            <span>
              Process Stock OUT (-{qty} {detectedUnit})
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
