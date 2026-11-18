import { useEffect, useState } from 'react';
import { StockItem } from '../store';
import { generateQRDataUrl } from '../utils/qrHelper';
import { X, Printer, QrCode, Download, Copy } from 'lucide-react';

interface QRLabelModalProps {
  items: StockItem[];
  onClose: () => void;
  title?: string;
}

type GeneratedLabel = {
  item: StockItem;
  dataUrl: string;
};

export default function QRLabelModal({
  items,
  onClose,
  title = 'Printable QR Labels',
}: QRLabelModalProps) {
  const [labels, setLabels] = useState<GeneratedLabel[]>([]);
  const [copiesInput, setCopiesInput] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(true);
  const copiesPerItem = Math.max(1, Math.min(50, parseInt(copiesInput, 10) || 1));

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
        const sizeHtml = item.size
          ? `<div class="size-line">Size: ${escaped(item.size)}</div>`
          : '';
        const colorHtml = item.color
          ? `<div class="color-line">Color: ${escaped(item.color)}</div>`
          : '';

        return `
          <div class="label-card">
            <img src="${dataUrl}" alt="QR Code" class="qr-img" />
            ${sizeHtml}
            ${colorHtml}
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
              padding: 12px;
            }
            .grid {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              align-items: flex-start;
            }
            .label-card {
              border: 1.5px dashed #334155;
              border-radius: 6px;
              padding: 4px;
              width: 156px;
              text-align: center;
              page-break-inside: avoid;
              break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .qr-img {
              width: 146px;
              height: 146px;
              display: block;
              margin: 0 auto 3px auto;
            }
            .size-line {
              font-size: 12px;
              font-weight: 700;
              color: #0f172a;
              line-height: 1.15;
              margin-bottom: 1px;
              word-break: break-word;
            }
            .color-line {
              font-size: 12px;
              font-weight: 700;
              color: #1e293b;
              line-height: 1.15;
              word-break: break-word;
            }
            @media print {
              body { padding: 4mm; }
              .grid { gap: 8px; }
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

  const handleDownloadSingle = (label: GeneratedLabel) => {
    // Draw a tight sticker image with minimal left/right/bottom margin
    const canvas = document.createElement('canvas');
    const width = 256;
    const height = 304;
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
      ctx.drawImage(img, 8, 8, 240, 240);

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';

      let y = 266;
      if (label.item.size) {
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`Size: ${label.item.size}`, width / 2, y);
        y += 22;
      }

      if (label.item.color) {
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`Color: ${label.item.color}`, width / 2, y);
      }

      const link = document.createElement('a');
      link.download = `QR_${label.item.barcode}.png`;
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
                  setCopiesInput(String(Math.min(50, parseInt(digits, 10))));
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
              (Total {labels.length * copiesPerItem} labels)
            </span>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || labels.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-md transition-colors cursor-pointer"
          >
            <Printer size={18} />
            <span>Print QR Labels ({labels.length * copiesPerItem})</span>
          </button>
        </div>

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
                  className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-2 w-[176px] flex flex-col items-center text-center shadow-xs relative group"
                >
                  <img
                    src={label.dataUrl}
                    alt="QR Code"
                    className="w-40 h-40 object-contain mb-1"
                  />
                  {/* Only Size & Color Shown Directly Below QR */}
                  {(label.item.size || label.item.color) && (
                    <div className="w-full pt-0.5 space-y-0.5">
                      {label.item.size && (
                        <p className="font-bold text-slate-800 text-sm leading-tight">
                          Size: {label.item.size}
                        </p>
                      )}
                      {label.item.color && (
                        <p className="font-bold text-slate-700 text-sm leading-tight">
                          Color: {label.item.color}
                        </p>
                      )}
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
