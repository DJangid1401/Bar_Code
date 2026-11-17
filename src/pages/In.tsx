import { useState } from 'react';
import { useStore } from '../store';
import QRScanner from '../components/QRScanner';
import { ArrowDownToLine, QrCode, PlusCircle } from 'lucide-react';

export default function In() {
  const { items, scanIn } = useStore();
  const [showScanner, setShowScanner] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');

  const handleScanSuccess = (scannedCode: string) => {
    setShowScanner(false);
    const existing = items.find(i => i.barcode === scannedCode);
    if (existing) {
      scanIn(scannedCode, existing.name);
      alert(`Success: +1 ${existing.name} IN ho gaya!`);
    } else {
      setBarcode(scannedCode);
    }
  };

  const handleManualIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) {
      alert("Barcode dalna zaroori hai!");
      return;
    }

    const existing = items.find(i => i.barcode === barcode.trim());
    if (existing) {
      scanIn(barcode.trim(), existing.name);
      alert(`Success: +1 ${existing.name} IN Done!`);
      setBarcode('');
      setName('');
    } else {
      if (!name.trim()) {
        alert("New Barcode, Please mention product name (Name)!");
        return;
      }
      scanIn(barcode.trim(), name.trim());
      alert(`Success: New item "${name.trim()}" Stock in done!`);
      setBarcode('');
      setName('');
    }
  };

  const detectedItem = items.find(i => i.barcode === barcode.trim());

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-6">
      <div className="text-center space-y-2">
        <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2">
          <ArrowDownToLine size={32} />
        </div>
        <h1 className="text-3xl font-bold text-slate-800">Stock IN (Inward)</h1>
        <p className="text-slate-500">Scan using the camera or use the manual entry form below.</p>
      </div>

      <div className="bg-white p-8 rounded-xl border shadow-sm space-y-6">
        <button 
          onClick={() => setShowScanner(true)}
          className="bg-green-600 hover:bg-green-700 text-white text-lg font-bold py-4 px-6 rounded-xl w-full flex items-center justify-center gap-3 shadow-md transition-transform active:scale-95"
        >
          <QrCode size={24} /> Start Camera Scanner
        </button>

        <div className="flex items-center gap-4 text-slate-400">
          <div className="flex-1 h-px bg-slate-200"></div>
          <span className="text-xs font-bold tracking-wider">YA MANUAL ENTRY KAREIN</span>
          <div className="flex-1 h-px bg-slate-200"></div>
        </div>

        <form onSubmit={handleManualIn} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Barcode / SKU *</label>
            <input 
              type="text" 
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Barcode type karein (e.g. BAR-001)" 
              className="w-full border-2 border-slate-200 p-3 rounded-xl text-base focus:border-green-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Product Name {detectedItem ? '(Existing Item)' : '(Naye item ke liye zaroori hai)'}
            </label>
            <input 
              type="text" 
              value={detectedItem ? detectedItem.name : name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!detectedItem}
              placeholder={detectedItem ? "System mein pehle se maujuda hai" : "Naye product ka naam likhein (e.g. Steel Rod)"} 
              className="w-full border-2 border-slate-200 p-3 rounded-xl text-base focus:border-green-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          <button 
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-xl w-full flex items-center justify-center gap-2 shadow-sm"
          >
            <PlusCircle size={20} /> Submit Stock IN (+1)
          </button>
        </form>
      </div>

      {showScanner && (
        <QRScanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}