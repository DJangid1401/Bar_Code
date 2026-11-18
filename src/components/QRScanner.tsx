import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
import { X, Camera, Image, AlertCircle, RefreshCw, SwitchCamera } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isStoppingRef = useRef<boolean>(false);

  const startCamera = async (cameraId?: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    // Stop existing camera if already scanning
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error("Error stopping existing scanner:", err);
      }
    }

    try {
      // Check if mediaDevices API is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isNotSecure =
          window.location.protocol !== 'https:' &&
          window.location.hostname !== 'localhost' &&
          window.location.hostname !== '127.0.0.1';
        if (isNotSecure) {
          throw new Error("INSECURE_CONTEXT");
        }
        throw new Error("MEDIA_DEVICES_NOT_SUPPORTED");
      }

      // Query available camera devices
      let devices: CameraDevice[] = [];
      try {
        devices = await Html5Qrcode.getCameras();
        setCameras(devices);
      } catch (camErr) {
        console.warn("Could not enumerate cameras upfront:", camErr);
      }

      // Determine target camera
      let targetCamera: string | MediaTrackConstraints;
      if (cameraId) {
        targetCamera = cameraId;
      } else if (devices.length > 0) {
        const backCamera = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        targetCamera = backCamera ? backCamera.id : devices[0].id;
        setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
      } else {
        targetCamera = { facingMode: "environment" };
      }

      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
      }

      const scanConfig = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      const handleSuccess = async (decodedText: string) => {
        if (isStoppingRef.current) return;
        isStoppingRef.current = true;
        try {
          if (scanner && scanner.isScanning) {
            await scanner.stop();
          }
        } catch (e) {
          console.error("Stop on success error:", e);
        }
        onScanSuccess(decodedText);
      };

      try {
        await scanner.start(targetCamera, scanConfig, handleSuccess, () => {});
      } catch (firstErr) {
        // If back camera constraint failed, try user/front facing camera fallback
        if (typeof targetCamera === 'object' && targetCamera.facingMode === 'environment') {
          await scanner.start({ facingMode: "user" }, scanConfig, handleSuccess, () => {});
        } else {
          throw firstErr;
        }
      }

      setIsLoading(false);
    } catch (err: unknown) {
      setIsLoading(false);
      console.error("Camera start failed:", err);
      const errStr = String(err instanceof Error ? err.message : err);

      if (errStr.includes("INSECURE_CONTEXT")) {
        setErrorMessage(
          "Mobile browsers block camera on insecure HTTP. Please access via 'localhost' or HTTPS, or use the Photo Upload option below."
        );
      } else if (errStr.includes("NotAllowedError") || errStr.includes("Permission denied")) {
        setErrorMessage(
          "Camera permission was denied. Please allow camera access in your browser settings (click the lock/camera icon in your address bar)."
        );
      } else if (
        errStr.includes("NotFoundError") ||
        errStr.includes("DevicesNotFoundError") ||
        errStr.includes("Requested device not found")
      ) {
        setErrorMessage(
          "No camera hardware detected on this device. If you're on a PC without a webcam, you can upload a photo of the barcode below."
        );
      } else if (
        errStr.includes("NotReadableError") ||
        errStr.includes("TrackStartError") ||
        errStr.includes("in use")
      ) {
        setErrorMessage(
          "Camera is currently in use by another application. Please close other camera apps and retry."
        );
      } else {
        setErrorMessage(errStr || "Unable to access camera.");
      }
    }
  };

  const handleCameraChange = (newCameraId: string) => {
    setSelectedCameraId(newCameraId);
    startCamera(newCameraId);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
      }

      if (scanner.isScanning) {
        await scanner.stop();
      }

      const decodedText = await scanner.scanFile(file, true);
      if (decodedText) {
        onScanSuccess(decodedText);
      }
    } catch (err) {
      console.error("Scan file error:", err);
      alert("No barcode or QR code detected in the image. Please upload a clear photo.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClose = async () => {
    isStoppingRef.current = true;
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {}
    }
    onClose();
  };

  useEffect(() => {
    isStoppingRef.current = false;
    startCamera();

    return () => {
      isStoppingRef.current = true;
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        if (scanner.isScanning) {
          scanner
            .stop()
            .catch(() => {})
            .finally(() => {
              try {
                scanner.clear();
              } catch {}
            });
        } else {
          try {
            scanner.clear();
          } catch {}
        }
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-800">
            <Camera className="text-blue-600" size={22} />
            <h3 className="text-lg font-bold">Scan QR / Barcode</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Camera Selection Dropdown (if multiple cameras available) */}
          {cameras.length > 1 && !errorMessage && (
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <SwitchCamera size={18} className="text-slate-500 shrink-0" />
              <select
                value={selectedCameraId}
                onChange={(e) => handleCameraChange(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
              >
                {cameras.map((cam, idx) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Scanner Viewport */}
          <div className="relative bg-black rounded-xl overflow-hidden min-h-[260px] flex items-center justify-center">
            {/* The html5-qrcode element */}
            <div
              id="qr-reader"
              className="w-full h-full [&_video]:w-full [&_video]:object-cover [&_video]:rounded-xl"
            ></div>

            {/* Loading Indicator */}
            {isLoading && !errorMessage && (
              <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center text-white gap-3 p-4">
                <RefreshCw className="animate-spin text-blue-400" size={32} />
                <p className="text-sm font-medium">Starting camera...</p>
              </div>
            )}

            {/* Error Message Overlay */}
            {errorMessage && (
              <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
                <div className="bg-red-500/20 text-red-400 p-3 rounded-full">
                  <AlertCircle size={32} />
                </div>
                <h4 className="font-semibold text-base">Camera Not Available</h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xs">{errorMessage}</p>

                <button
                  onClick={() => startCamera(selectedCameraId)}
                  className="mt-2 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw size={14} /> Retry Camera
                </button>
              </div>
            )}
          </div>

          {/* Fallback / Upload Section */}
          <div className="pt-2 border-t border-slate-100">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
              id="barcode-image-upload"
            />
            <label
              htmlFor="barcode-image-upload"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm cursor-pointer transition-colors border border-slate-200"
            >
              <Image size={18} className="text-slate-500" />
              <span>Upload / Capture Barcode Image</span>
            </label>
            <p className="text-[11px] text-slate-400 text-center mt-1.5">
              No webcam? Take a photo or upload an image file of the barcode.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
