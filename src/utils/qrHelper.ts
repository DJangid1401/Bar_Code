import QRCode from 'qrcode';

export type AllowedUnit = 'PCS' | 'KGS' | 'PAC';

export function normalizeUnit(unit?: string): AllowedUnit {
  const u = (unit || '').trim().toUpperCase();
  if (u === 'KG' || u === 'KGS' || u === 'KILOGRAM' || u === 'KILOGRAMS') {
    return 'KGS';
  }
  if (u === 'PAC' || u === 'PACK' || u === 'PACKS' || u === 'PKT' || u === 'PACKET' || u === 'PACKETS') {
    return 'PAC';
  }
  return 'PCS';
}

export type QRItemDetails = {
  barcode: string;
  name: string;
  size?: string;
  color?: string;
  unit?: string;
  stock?: number;
};

/**
 * Builds structured human-readable product details to embed inside the QR code.
 * Scannable both by external phone QR readers and directly parsed by this app.
 */
export function buildQRPayload(item: QRItemDetails): string {
  const lines = [`Code: ${item.barcode}`, `Product: ${item.name}`];
  if (item.size) lines.push(`Size: ${item.size}`);
  if (item.color) lines.push(`Color: ${item.color}`);
  lines.push(`Unit: ${normalizeUnit(item.unit)}`);
  return lines.join('\n');
}

export type ParsedQR = {
  barcode: string;
  name?: string;
  size?: string;
  color?: string;
  unit?: AllowedUnit;
};

/**
 * Extracts barcode and product details from a scanned QR code or plain barcode string.
 */
export function parseScannedQR(decodedText: string): ParsedQR {
  const text = decodedText.trim();

  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const obj = JSON.parse(text);
      if (obj.code || obj.barcode) {
        return {
          barcode: String(obj.code || obj.barcode).trim(),
          name: obj.name || obj.product ? String(obj.name || obj.product).trim() : undefined,
          size: obj.size ? String(obj.size).trim() : undefined,
          color: obj.color ? String(obj.color).trim() : undefined,
          unit: obj.unit ? normalizeUnit(String(obj.unit)) : undefined,
        };
      }
    } catch {
      // fall through
    }
  }

  if (text.includes('Code:')) {
    const lines = text.split(/\r?\n/);
    const result: Partial<ParsedQR> = {};
    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim();
      if (key === 'code' || key === 'barcode' || key === 'unique code') {
        result.barcode = val;
      } else if (key === 'product' || key === 'name' || key === 'product name') {
        result.name = val;
      } else if (key === 'size') {
        result.size = val;
      } else if (key === 'color' || key === 'colour') {
        result.color = val;
      } else if (key === 'unit') {
        result.unit = normalizeUnit(val);
      }
    }
    if (result.barcode) {
      return result as ParsedQR;
    }
  }

  return { barcode: text };
}

/**
 * Generates a crisp PNG Data URL for a product's QR code.
 */
export async function generateQRDataUrl(item: QRItemDetails): Promise<string> {
  const payload = buildQRPayload(item);
  return QRCode.toDataURL(payload, {
    width: 240,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}
