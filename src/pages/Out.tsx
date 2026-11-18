import { useState } from 'react';
import { useStore } from '../store';
import QRScanner from '../components/QRScanner';
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
} from 'lucide-react';

type OutKgMode = 'PACKETS_500G' | 'DIRECT_KG';

export default function Out() {
  const { items, scanOut, isSyncing } = useStore();
  const [showScanner, setShowScanner] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [qty, setQty] = useState<string>('1');
  const [outKgMode, setOutKgMode] = useState<OutKgMode>('PACKETS_500G');

  const detectedItem = items.find(
    i => i.barcode.toLowerCase() === barcode.trim().toLowerCase()
  );

  const detectedUnit = detectedItem ? normalizeUnit(detectedItem.unit) : 'KGS';
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

  const handleScanSuccess = (decodedText: string) => {
    setShowScanner(false);
    const parsed = parseScannedQR(decodedText);
    setBarcode(parsed.barcode.trim());
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
      alert('Please enter a Product Code to process Stock OUT.');
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

    const result = await scanOut({
      barcode: trimmedBarcode,
      qty: finalQtyToDeduct,
    });

    alert(result.message);
    if (result.success) {
      setBarcode('');
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
                {isKgs && (
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
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
                  Color: <strong>{detectedItem.color}</strong>
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
              This product code is not registered in inventory. Please add it via Stock IN first.
            </span>
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
              placeholder="Scan QR or enter product code (e.g. PRD-HM003)"
              className="w-full border-2 border-slate-200 p-3 rounded-xl text-base font-mono focus:border-red-500 focus:outline-none"
              required
            />
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

            {/* Quick Preset Selection Chips by Unit (KGS / PAC / PCS) */}
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

            {/* Live Conversion & Dispatch Preview */}
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
          </div>

          <button
            type="submit"
            disabled={
              isSyncing ||
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
                ? `Process Stock OUT (-${finalQtyToDeduct} KGS • ${rawNumber} ${rawNumber === 1 ? 'Packet' : 'Packets'})`
                : `Process Stock OUT (-${finalQtyToDeduct} ${detectedUnit})`}
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
