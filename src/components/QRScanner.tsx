import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear();
        onScanSuccess(decodedText);
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(err => console.error("Scanner clear fail:", err));
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white p-4 rounded-lg w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Scan QR / Barcode</h3>
          <button onClick={onClose} className="text-red-500 hover:bg-red-50 p-1 rounded-md">
            <X size={24} />
          </button>
        </div>
        <div id="qr-reader" className="w-full"></div>
      </div>
    </div>
  );
}