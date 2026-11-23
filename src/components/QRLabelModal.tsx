import { useEffect, useState } from 'react';
import { StockItem, useStore } from '../store';
import { generateQRDataUrl } from '../utils/qrHelper';
import { X, Printer, QrCode, Download, Copy, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface QRLabelModalProps {
  items: StockItem[];
  onClose: () => void;
  title?: string;
  initialAutoStockIn?: boolean;
}

type GeneratedLabel = {
  item: StockItem;
  dataUrl: string;
};

export default function QRLabelModal({
  items,
  onClose,
  title = 'Printable QR Labels',
  initialAutoStockIn = true,
}: QRLabelModalProps) {
  const { scanIn, bulkStockIn } = useStore();
  const [labels, setLabels] = useState<GeneratedLabel[]>([]);
  const [copiesInput, setCopiesInput] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(true);
  const [autoStockIn, setAutoStockIn] = useState<boolean>(initialAutoStockIn);
  const [isSubmittingStockIn, setIsSubmittingStockIn] = useState<boolean>(false);
  const [stockInSuccessMessage, setStockInSuccessMessage] = useState<string | null>(null);
  const [stockInErrorMessage, setStockInErrorMessage] = useState<string | null>(null);

  const parsedCopies = parseInt(copiesInput, 10);
  const copiesPerItem = Math.max(1, Math.min(1000, isNaN(parsedCopies) ? 1 : parsedCopies));

  useEffect(() => {
    let active = true;
    const generateAll = async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          items.map(async item => ({
            item,
            dataUrl: await generateQRDataUrl(item),
          }))
        );
        if (active) {
          setLabels(results);
        }
      } catch (err) {
        console.error('QR generation failed:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    generateAll();
    return () => {
      active = false;
    };
  }, [items]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Popup blocked! Please allow popups in your browser to print QR labels.');
      return;
    }

    const escaped = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const repeatedLabels: GeneratedLabel[] = [];
    for (const label of labels) {
      for (let c = 0; c < copiesPerItem; c++) {
        repeatedLabels.push(label);
      }
    }

    const cardsHtml = repeatedLabels
      .map(({ item, dataUrl }) => {
        const labelText = [item.size, item.color].filter(Boolean).join(', ');
        const textHtml = labelText
          ? `<div class="detail-line">${escaped(labelText)}</div>`
          : '';

        return `
          <div class="label-card">
            <img src="${dataUrl}" alt="QR Code" class="qr-img" />
            ${textHtml}
          </div>
        `;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print QR Labels</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              background: #fff;
              color: #000;
              padding: 4mm;
            }
            .grid {
              display: flex;
              flex-wrap: wrap;
              gap: 3mm;
              align-items: flex-start;
            }
            .label-card {
              border: 0.4mm dashed #334155;
              border-radius: 1.5mm;
              padding: 2mm;
              width: 34mm;
              text-align: center;
              page-break-inside: avoid;
              break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .qr-img {
              width: 30mm;
              height: 30mm;
              display: block;
              margin: 0 auto 1.5mm auto;
            }
            .detail-line {
              font-size: 8.5pt;
              font-weight: 700;
              color: #0f172a;
              line-height: 1.2;
              word-break: break-word;
            }
            @media print {
              body { padding: 3mm; }
              .grid { gap: 2.5mm; }
            }
          </style>
        </head>
        <body>
          <div class="grid">${cardsHtml}</div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintAndProcessStockIn = async () => {
    // 1. Immediately trigger the print dialog so popups are not blocked
    handlePrint();

    // 2. If autoStockIn is checked, automatically record as Stock IN
    if (autoStockIn && items.length > 0) {
      setIsSubmittingStockIn(true);
      setStockInSuccessMessage(null);
      setStockInErrorMessage(null);

      try {
        if (items.length === 1) {
          const single = items[0];
          const res = await scanIn({
            barcode: single.barcode,
            name: single.name,
            qty: copiesPerItem,
            size: single.size,
            color: single.color,
            unit: single.unit,
            source: 'SCAN',
          });

          if (res.success) {
            setStockInSuccessMessage(
              `✅ Stock IN Updated: +${copiesPerItem} ${single.unit || 'PCS'} added to "${single.name}" (${single.barcode})`
            );
          } else {
            setStockInErrorMessage(res.message || 'Failed to update Stock IN.');
          }
        } else {
          // Multiple items
          const entries = items.map(item => ({
            barcode: item.barcode,
            name: item.name,
            size: item.size,
            color: item.color,
            qty: copiesPerItem,
            unit: item.unit,
          }));

          const res = await bulkStockIn(entries);
          if (res.count > 0) {
            setStockInSuccessMessage(
              `✅ Stock IN Updated: +${copiesPerItem} each added to ${items.length} products (Total: +${items.length * copiesPerItem})`
            );
          } else {
            setStockInErrorMessage(res.message || 'Failed to update Stock IN.');
          }
        }
      } catch (err) {
        console.error('Stock IN update failed:', err);
        setStockInErrorMessage('An error occurred while updating Stock IN.');
      } finally {
        setIsSubmittingStockIn(false);
      }
    }
  };

  const handleDownloadSingle = (label: GeneratedLabel) => {
    // 30mm x 30mm QR at 300 DPI = 354 x 354 px
    const canvas = document.createElement('canvas');
    const width = 380;
    const height = 435;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 13, 12, 354, 354);

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';

      const detailText = [label.item.size, label.item.color].filter(Boolean).join(', ');
      if (detailText) {
        ctx.font = 'bold 21px sans-serif';
        ctx.fillText(detailText, width / 2, 398, width - 20);
      }

      const link = document.createElement('a');
      link.download = `QR_30mm_${label.item.barcode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = label.dataUrl;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
              <QrCode size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{title}</h3>
              <p className="text-xs text-slate-500">
                Product details are embedded inside each QR code — only Size &amp; Color are printed below.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Copy size={16} className="text-slate-400" />
            <span className="font-semibold">Copies per product:</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={copiesInput}
              onChange={e => {
                const digits = e.target.value.replace(/[^\d]/g, '');
                if (!digits) {
                  setCopiesInput('');
                } else {
                  setCopiesInput(String(Math.min(1000, parseInt(digits, 10))));
                }
              }}
              onBlur={() => {
                if (!copiesInput || parseInt(copiesInput, 10) < 1) {
                  setCopiesInput('1');
                }
              }}
              className="w-20 border border-slate-300 rounded-lg px-2.5 py-1 text-center font-bold focus:outline-none focus:border-blue-500"
            />
            <span className="text-xs text-slate-400">
              (Total {labels.length * copiesPerItem} labels &bull; QR: 30mm &times; 30mm)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold cursor-pointer hover:bg-emerald-100 transition-colors select-none">
              <input
                type="checkbox"
                checked={autoStockIn}
                onChange={e => setAutoStockIn(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer accent-emerald-600"
              />
              <span>
                Record as Stock IN (+{copiesPerItem * items.length}{' '}
                {items.length === 1 && items[0].unit ? items[0].unit : 'items'} on print)
              </span>
            </label>

            <button
              type="button"
              onClick={handlePrintAndProcessStockIn}
              disabled={loading || labels.length === 0 || isSubmittingStockIn}
              className={`text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                autoStockIn ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmittingStockIn ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Recording Stock IN...</span>
                </>
              ) : (
                <>
                  <Printer size={18} />
                  <span>
                    {autoStockIn
                      ? `Print & Add to Stock IN (+${labels.length * copiesPerItem})`
                      : `Print QR Labels (${labels.length * copiesPerItem})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {stockInSuccessMessage && (
          <div className="mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>{stockInSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setStockInSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1 rounded-md cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Error Alert Banner */}
        {stockInErrorMessage && (
          <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-red-600 shrink-0" />
              <span>{stockInErrorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setStockInErrorMessage(null)}
              className="text-red-700 hover:text-red-900 p-1 rounded-md cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Preview Grid */}
        <div className="p-6 overflow-y-auto bg-slate-50/70 flex-1">
          {loading ? (
            <div className="text-center py-16 text-slate-400 font-medium">
              Generating QR codes...
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-4">
              {labels.map(label => (
                <div
                  key={label.item.barcode}
                  className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-2 w-[142px] flex flex-col items-center text-center shadow-xs relative group"
                >
                  <img
                    src={label.dataUrl}
                    alt="QR Code"
                    className="w-[114px] h-[114px] object-contain mb-1"
                  />
                  {/* Compact Detail Text Below QR (e.g. 6 MM HOLE MOTI, T-19) */}
                  {(label.item.size || label.item.color) && (
                    <div className="w-full pt-0.5">
                      <p className="font-bold text-slate-800 text-xs leading-tight">
                        {[label.item.size, label.item.color].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}

                  {/* Download Single Sticker Button */}
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(label)}
                    className="mt-3 w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="Download QR sticker PNG"
                  >
                    <Download size={14} />
                    <span>Download PNG</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
