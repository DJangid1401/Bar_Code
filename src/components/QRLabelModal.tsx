import { useEffect, useState } from 'react';
import { StockItem } from '../store';
import { generateQRDataUrl, normalizeUnit } from '../utils/qrHelper';
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
        const unit = normalizeUnit(item.unit);
        const metaParts: string[] = [];
        if (item.size) metaParts.push(`Size: ${escaped(item.size)}`);
        if (item.color) metaParts.push(`Color: ${escaped(item.color)}`);
        metaParts.push(`Unit: ${escaped(unit)}`);

        return `
          <div class="label-card">
            <img src="${dataUrl}" alt="${escaped(item.barcode)}" class="qr-img" />
            <div class="code">${escaped(item.barcode)}</div>
            <div class="name">${escaped(item.name)}</div>
            <div class="meta">${metaParts.join(' &bull; ')}</div>
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
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
            }
            .label-card {
              border: 1.5px dashed #334155;
              border-radius: 8px;
              padding: 10px 8px;
              text-align: center;
              page-break-inside: avoid;
              break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .qr-img {
              width: 140px;
              height: 140px;
              display: block;
              margin: 0 auto 6px auto;
            }
            .code {
              font-family: Consolas, Monaco, monospace;
              font-size: 14px;
              font-weight: 800;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .name {
              font-size: 13px;
              font-weight: 700;
              margin-bottom: 3px;
              word-break: break-word;
            }
            .meta {
              font-size: 11px;
              color: #334155;
              line-height: 1.3;
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
    // Draw a crisp sticker image (QR + product details below) onto canvas for download
    const canvas = document.createElement('canvas');
    const width = 340;
    const height = 430;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, width - 16, height - 16);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, (width - 240) / 2, 24, 240, 240);

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';

      ctx.font = 'bold 22px Consolas, monospace';
      ctx.fillText(label.item.barcode, width / 2, 295);

      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(label.item.name.slice(0, 28), width / 2, 326);

      ctx.fillStyle = '#475569';
      ctx.font = '15px sans-serif';
      const detailLine1 = [
        label.item.size ? `Size: ${label.item.size}` : '',
        label.item.color ? `Color: ${label.item.color}` : '',
      ]
        .filter(Boolean)
        .join('  |  ');
      if (detailLine1) {
        ctx.fillText(detailLine1, width / 2, 356);
      }

      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`Unit: ${normalizeUnit(label.item.unit)}`, width / 2, 384);

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
                Product details are embedded inside each QR code — print and attach to products for quick scanning.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {labels.map(label => (
                <div
                  key={label.item.barcode}
                  className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center text-center shadow-xs relative group"
                >
                  <img
                    src={label.dataUrl}
                    alt={`QR for ${label.item.barcode}`}
                    className="w-40 h-40 object-contain mb-2"
                  />
                  {/* Product Details Directly Below QR */}
                  <div className="w-full border-t border-slate-100 pt-2.5 space-y-1">
                    <p className="font-mono font-extrabold text-slate-900 text-base tracking-wide">
                      {label.item.barcode}
                    </p>
                    <p className="font-bold text-slate-800 text-sm leading-tight">
                      {label.item.name}
                    </p>
                    <div className="flex flex-wrap justify-center gap-1.5 text-xs text-slate-600 pt-0.5">
                      {label.item.size && (
                        <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold">
                          Size: {label.item.size}
                        </span>
                      )}
                      {label.item.color && (
                        <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold">
                          Color: {label.item.color}
                        </span>
                      )}
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
                        Unit: {normalizeUnit(label.item.unit)}
                      </span>
                    </div>
                  </div>

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
