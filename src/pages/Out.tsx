import { useState } from 'react';
import { useStore } from '../store';
import QRScanner from '../components/QRScanner';
import { ArrowUpFromLine, QrCode, MinusCircle } from 'lucide-react';

export default function Out() {
  const { scanOut } = useStore();
  const [showScanner, setShowScanner] = useState(false);
  const [barcode, setBarcode] = useState('');

  const handleScanSuccess = (scannedCode: string) => {
    setShowScanner(false);
    const result = scanOut(scannedCode);
    alert(result.message);
  };

  const handleManualOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) {
      alert("Stock OUT karne ke liye barcode dalna mandatory hai!");
      return;
    }

    const result = scanOut(barcode.trim());
    alert(result.message);
    if (result.success) {
      setBarcode('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-6">
      <div className="text-center space-y-2">
        <div className="bg-red-100 text-red-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2">
          <ArrowUpFromLine size={32} />
        </div>
        <h1 className="text-3xl font-bold text-slate-800">Stock OUT (Dispatch / Sale)</h1>
        <p className="text-slate-500">Scan using the camera or enter the barcode manually to reduce stock.</p>
      </div>

      <div className="bg-white p-8 rounded-xl border shadow-sm space-y-6">
        {/* Camera Scan Button */}
        <button 
          onClick={() => setShowScanner(true)}
          className="bg-red-600 hover:bg-red-700 text-white text-lg font-bold py-4 px-6 rounded-xl w-full flex items-center justify-center gap-3 shadow-md transition-transform active:scale-95"
        >
          <QrCode size={24} /> Start Camera Scanner
        </button>

        <div className="flex items-center gap-4 text-slate-400">
          <div className="flex-1 h-px bg-slate-200"></div>
          <span className="text-xs font-bold tracking-wider">YA MANUAL ENTRY KAREIN</span>
          <div className="flex-1 h-px bg-slate-200"></div>
        </div>

        {/* Proper Manual Form (Mandatory Barcode) */}
        <form onSubmit={handleManualOut} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Barcode / SKU (Mandatory) *</label>
            <input 
              type="text" 
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Barcode type karein (e.g. BAR-001)" 
              className="w-full border-2 border-slate-200 p-3 rounded-xl text-base focus:border-red-500 focus:outline-none"
              required
            />
            <p className="text-xs text-slate-400 mt-1">Bina barcode dale OUT process nahi hoga.</p>
          </div>

          <button 
            type="submit"
            disabled={!barcode.trim()}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl w-full flex items-center justify-center gap-2 shadow-sm"
          >
            <MinusCircle size={20} /> Process Stock OUT (-1)
          </button>
        </form>
      </div>

      {showScanner && (
        <QRScanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}