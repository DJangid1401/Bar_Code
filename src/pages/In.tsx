import { useState, useEffect } from 'react';
import { useStore, StockItem } from '../store';
import QRScanner from '../components/QRScanner';
import QRLabelModal from '../components/QRLabelModal';
import VoiceSearchButton from '../components/VoiceSearchButton';
import { normalizeVoiceQuery, findBestVoiceMatch } from '../utils/voiceHelper';
import {
  AllowedUnit,
  normalizeUnit,
  parseScannedQR,
  PACKET_WEIGHT_KG,
  packetsToKg,
  roundQty,
  sanitizeDecimalInput,
} from '../utils/qrHelper';
import {
  ArrowDownToLine,
  QrCode,
  PlusCircle,
  CheckCircle,
  Printer,
  Scale,
  Package,
} from 'lucide-react';

type KgEntryMode = 'DIRECT_KG' | 'PACKETS_500G';

export default function In() {
  const { items, scanIn, isSyncing } = useStore();
  const [showScanner, setShowScanner] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [qty, setQty] = useState<string>('1');
  const [unit, setUnit] = useState<AllowedUnit>('KGS');
  const [kgMode, setKgMode] = useState<KgEntryMode>('DIRECT_KG');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [lastSavedItem, setLastSavedItem] = useState<StockItem | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  const isKgs = unit === 'KGS';
  const rawNumber = isKgs && kgMode === 'DIRECT_KG' ? parseFloat(qty) || 0 : parseInt(qty, 10) || 0;
  const finalQtyToSave =
    isKgs && kgMode === 'PACKETS_500G' ? packetsToKg(rawNumber) : roundQty(rawNumber);

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
      setUnit(parsed.unit || 'KGS');
    }
  };

  const handleSwitchKgMode = (mode: KgEntryMode) => {
    setKgMode(mode);
    setQty(mode === 'PACKETS_500G' ? '1' : '1');
  };

  const handleStep = (delta: number) => {
    if (isKgs && kgMode === 'DIRECT_KG') {
      const next = roundQty(Math.max(0.5, rawNumber + delta * 0.5));
      setQty(String(next));
    } else {
      const next = Math.max(1, Math.round(rawNumber) + delta);
      setQty(String(next));
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

    if (!finalQtyToSave || finalQtyToSave <= 0) {
      alert('Please enter a valid quantity greater than 0.');
      return;
    }

    const result = await scanIn({
      barcode: barcode.trim(),
      name: name.trim(),
      size: size.trim(),
      color: color.trim(),
      qty: finalQtyToSave,
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
      setQty('1');
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
                {normalizeUnit(detectedItem.unit) === 'KGS' && (
                  <span> ({roundQty(detectedItem.stock / PACKET_WEIGHT_KG)} packets of 500g)</span>
                )}
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
            <div className="relative">
              <input
                type="text"
                value={barcode}
                onChange={e => {
                  setBarcode(e.target.value);
                  setLastScanned(null);
                }}
                placeholder="Enter product code (e.g. PRD-HM001)"
                className="w-full border-2 border-slate-200 p-3 pr-14 rounded-xl text-base font-mono focus:border-green-500 focus:outline-none"
                required
              />
              <div className="absolute right-2.5 top-2.5">
                <VoiceSearchButton
                  size="sm"
                  buttonTitle="Unique product code bol kar enter karein"
                  showLangToggle={true}
                  onTranscript={(spoken, alternatives) => {
                    const norm = normalizeVoiceQuery(spoken);
                    const matchRes = findBestVoiceMatch(spoken, items, alternatives);
                    if (matchRes.match) {
                      setBarcode(matchRes.match.barcode);
                      setName(matchRes.match.name);
                      setSize(matchRes.match.size || '');
                      setColor(matchRes.match.color || '');
                      setUnit(normalizeUnit(matchRes.match.unit));
                    } else {
                      setBarcode(norm);
                    }
                    setLastScanned(null);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Product Name / Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Product Name / Category *
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. HOLE MOTI, TYRE"
                className="w-full border-2 border-slate-200 p-3 pr-14 rounded-xl text-base focus:border-green-500 focus:outline-none"
                required
              />
              <div className="absolute right-2.5 top-2.5">
                <VoiceSearchButton
                  size="sm"
                  buttonTitle="Product name bol kar likhein"
                  onTranscript={spoken => setName(normalizeVoiceQuery(spoken))}
                />
              </div>
            </div>
          </div>

          {/* Size and Color (2 columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Size (Optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  placeholder="e.g. 6 MM HOLE MOTI, 2.5 MM"
                  className="w-full border-2 border-slate-200 p-3 pr-14 rounded-xl text-base focus:border-green-500 focus:outline-none"
                />
                <div className="absolute right-2.5 top-2.5">
                  <VoiceSearchButton
                    size="sm"
                    buttonTitle="Size bol kar likhein"
                    onTranscript={spoken => setSize(normalizeVoiceQuery(spoken))}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Color (Optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  placeholder="e.g. T-1, T-7, Black"
                  className="w-full border-2 border-slate-200 p-3 pr-14 rounded-xl text-base focus:border-green-500 focus:outline-none"
                />
                <div className="absolute right-2.5 top-2.5">
                  <VoiceSearchButton
                    size="sm"
                    buttonTitle="Color bol kar likhein"
                    onTranscript={spoken => setColor(normalizeVoiceQuery(spoken))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Base Unit Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Base Stock Unit *
            </label>
            <select
              value={unit}
              onChange={e => {
                const nextUnit = normalizeUnit(e.target.value);
                setUnit(nextUnit);
                if (nextUnit !== 'KGS') {
                  setQty(String(Math.max(1, Math.round(rawNumber) || 1)));
                }
              }}
              className="w-full border-2 border-slate-200 p-3 rounded-xl text-base bg-white font-semibold focus:border-green-500 focus:outline-none cursor-pointer"
            >
              <option value="KGS">KGS (Kilograms — Supports Direct KG &amp; 500g Packets)</option>
              <option value="PAC">PAC (Packets)</option>
              <option value="PCS">PCS (Pieces)</option>
            </select>
          </div>

          {/* KGS Entry Mode Toggle (Direct KGS vs 500g Packets) */}
          {isKgs && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Select Inward Entry Mode
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSwitchKgMode('DIRECT_KG')}
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
                    kgMode === 'DIRECT_KG'
                      ? 'bg-green-600 text-white border-green-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Scale size={16} />
                  <span>Direct KGS</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchKgMode('PACKETS_500G')}
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
                    kgMode === 'PACKETS_500G'
                      ? 'bg-green-600 text-white border-green-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Package size={16} />
                  <span>500g Packets</span>
                </button>
              </div>
            </div>
          )}

          {/* Quantity Input with +/- Steppers */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              {isKgs
                ? kgMode === 'PACKETS_500G'
                  ? 'Number of 500g Packets *'
                  : 'Weight in KGS (e.g. 5.5) *'
                : `Quantity (${unit}) *`}
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
                inputMode={isKgs && kgMode === 'DIRECT_KG' ? 'decimal' : 'numeric'}
                value={qty}
                onChange={e =>
                  setQty(
                    isKgs && kgMode === 'DIRECT_KG'
                      ? sanitizeDecimalInput(e.target.value)
                      : e.target.value.replace(/[^\d]/g, '')
                  )
                }
                placeholder={
                  isKgs && kgMode === 'DIRECT_KG'
                    ? 'e.g. 5.5'
                    : isKgs && kgMode === 'PACKETS_500G'
                    ? 'e.g. 10'
                    : 'Enter qty'
                }
                className="w-full border-2 border-slate-200 p-3 rounded-xl text-base text-center font-bold text-slate-800 focus:border-green-500 focus:outline-none"
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

            {/* Quick Preset Chips by Unit (KGS Packets / PAC / PCS) */}
            {isKgs && kgMode === 'PACKETS_500G' && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[1, 2, 5, 10, 20].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQty(String(preset))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      rawNumber === preset
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset} {preset === 1 ? 'Pkt' : 'Pkts'} ({packetsToKg(preset)} kg)
                  </button>
                ))}
              </div>
            )}

            {unit === 'PAC' && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[1, 2, 5, 10, 20].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQty(String(preset))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      rawNumber === preset
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    +{preset} PAC
                  </button>
                ))}
              </div>
            )}

            {unit === 'PCS' && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[1, 5, 10, 25, 50].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQty(String(preset))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      rawNumber === preset
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    +{preset} PCS
                  </button>
                ))}
              </div>
            )}

            {/* Live Calculation Preview Box */}
            {isKgs && kgMode === 'PACKETS_500G' && rawNumber > 0 && (
              <div className="mt-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-900 flex items-center justify-between">
                <span className="font-medium">
                  KGS Logic: <strong>{rawNumber}</strong> packets &times;{' '}
                  <strong>{PACKET_WEIGHT_KG} kg</strong>
                </span>
                <span className="font-extrabold text-green-700 text-base">
                  = +{finalQtyToSave} KGS
                </span>
              </div>
            )}

            {!isKgs && finalQtyToSave > 0 && (
              <div className="mt-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-900 flex items-center justify-between">
                <span className="font-medium">
                  {unit} Logic: Direct {unit === 'PAC' ? 'Packet' : 'Piece'} Inward
                  {detectedItem && (
                    <span className="text-xs text-green-700 ml-2">
                      (New stock: {roundQty(detectedItem.stock + finalQtyToSave)} {unit})
                    </span>
                  )}
                </span>
                <span className="font-extrabold text-green-700 text-base">
                  +{finalQtyToSave} {unit}
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSyncing || finalQtyToSave <= 0}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl w-full flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer mt-2"
          >
            <PlusCircle size={22} />
            <span>
              {isSyncing
                ? 'Saving Stock IN...'
                : isKgs && kgMode === 'PACKETS_500G'
                ? `Submit Stock IN (+${finalQtyToSave} KGS • ${rawNumber} ${rawNumber === 1 ? 'Packet' : 'Packets'})`
                : `Submit Stock IN (+${finalQtyToSave} ${unit})`}
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
