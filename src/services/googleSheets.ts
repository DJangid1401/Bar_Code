import { AllowedUnit, normalizeUnit } from '../utils/qrHelper';

export type SheetStockItem = {
  barcode: string;
  name: string;
  size: string;
  color: string;
  totalIn: number;
  totalOut: number;
  stock: number;
  unit: AllowedUnit;
  updatedBy?: string;
  updatedAt?: number;
};

export type SheetTransaction = {
  id: string;
  type: 'IN' | 'OUT';
  barcode: string;
  name: string;
  size?: string;
  color?: string;
  qty: number;
  unit?: AllowedUnit;
  source?: 'SCAN' | 'MANUAL' | 'EXCEL_IMPORT';
  doneBy?: string;
  timestamp: number;
};

export type SheetActionType =
  | 'SCAN_IN'
  | 'SCAN_OUT'
  | 'BULK_STOCK_IN'
  | 'UPDATE_ITEM'
  | 'DELETE_ITEM'
  | 'DELETE_LOG';

export type SheetApiResponse = {
  success: boolean;
  message?: string;
  count?: number;
  item?: SheetStockItem;
  importedItems?: SheetStockItem[];
  items?: SheetStockItem[];
  logs?: SheetTransaction[];
};

const ENV_URL = (import.meta.env.VITE_GOOGLE_SHEET_URL || '').trim();

export function getGoogleSheetUrl(): string {
  return ENV_URL;
}

export function isGoogleSheetConfigured(): boolean {
  const url = getGoogleSheetUrl();
  return (
    Boolean(url) &&
    url.startsWith('https://script.google.com/') &&
    !url.includes('YOUR_DEPLOYMENT_ID')
  );
}

function normalizeItem(raw: Partial<SheetStockItem>): SheetStockItem {
  return {
    barcode: String(raw.barcode || '').trim(),
    name: String(raw.name || '').trim(),
    size: String(raw.size || '').trim(),
    color: String(raw.color || '').trim(),
    totalIn: Number(raw.totalIn) || 0,
    totalOut: Number(raw.totalOut) || 0,
    stock: Number(raw.stock) || 0,
    unit: normalizeUnit(raw.unit),
    updatedBy: String(raw.updatedBy || '').trim(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

function normalizeLog(raw: Partial<SheetTransaction>): SheetTransaction {
  return {
    id: String(raw.id || ''),
    type: raw.type === 'OUT' ? 'OUT' : 'IN',
    barcode: String(raw.barcode || '').trim(),
    name: String(raw.name || '').trim(),
    size: String(raw.size || '').trim(),
    color: String(raw.color || '').trim(),
    qty: Number(raw.qty) || 1,
    unit: normalizeUnit(raw.unit),
    source: raw.source || 'MANUAL',
    doneBy: String(raw.doneBy || '').trim(),
    timestamp: Number(raw.timestamp) || Date.now(),
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 25000
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'follow',
    });
  } finally {
    window.clearTimeout(timer);
  }
}

async function parseJsonResponse(res: Response): Promise<SheetApiResponse> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google Sheets HTTP Error (${res.status}): ${text.slice(0, 160)}`);
  }

  try {
    const data = JSON.parse(text) as SheetApiResponse;
    if (data.items) {
      data.items = data.items.map(normalizeItem);
    }
    if (data.logs) {
      data.logs = data.logs.map(normalizeLog);
    }
    if (data.item) {
      data.item = normalizeItem(data.item);
    }
    if (data.importedItems) {
      data.importedItems = data.importedItems.map(normalizeItem);
    }
    return data;
  } catch {
    throw new Error(
      'Invalid response from Google Apps Script. Ensure deployment access is set to "Anyone" and the URL ends with "/exec".'
    );
  }
}

/**
 * GET: Read all inventory items & transaction logs from Google Sheet
 */
export async function fetchGoogleSheetData(): Promise<{
  items: SheetStockItem[];
  logs: SheetTransaction[];
}> {
  if (!isGoogleSheetConfigured()) {
    throw new Error(
      'Google Sheet Web App URL is not configured. Please add VITE_GOOGLE_SHEET_URL in .env.local.'
    );
  }

  const baseUrl = getGoogleSheetUrl();
  const separator = baseUrl.includes('?') ? '&' : '?';
  const url = `${baseUrl}${separator}_ts=${Date.now()}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: 'GET',
    },
    20000
  );

  const data = await parseJsonResponse(response);
  if (!data.success) {
    throw new Error(data.message || 'Failed to read data from Google Sheet.');
  }

  return {
    items: data.items || [],
    logs: data.logs || [],
  };
}

/**
 * POST: Add, Update, Out, Bulk Import, or Delete records in Google Sheet.
 * Uses text/plain Content-Type to avoid CORS preflight failures with Google Apps Script.
 */
export async function postGoogleSheetAction(
  action: SheetActionType,
  payload: Record<string, unknown>
): Promise<SheetApiResponse> {
  if (!isGoogleSheetConfigured()) {
    throw new Error(
      'Google Sheet Web App URL is not configured. Please add VITE_GOOGLE_SHEET_URL in .env.local.'
    );
  }

  const response = await fetchWithTimeout(
    getGoogleSheetUrl(),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action, payload }),
    },
    30000
  );

  const data = await parseJsonResponse(response);
  if (!data.success) {
    throw new Error(data.message || `Google Sheet action "${action}" failed.`);
  }

  return data;
}
