import { AllowedUnit, normalizeUnit, roundQty } from '../utils/qrHelper';
import { Customer } from '../types/customer';

export type SheetStockItem = {
  barcode: string;
  name: string;
  size: string;
  color: string;
  price?: number;
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
  price?: number;
  totalAmount?: number;
  source?: 'SCAN' | 'MANUAL' | 'EXCEL_IMPORT';
  doneBy?: string;
  customerName?: string;
  timestamp: number;
};

export type SheetUser = {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: 'Admin' | 'Staff';
  createdAt?: number;
};

export type SheetActionType =
  | 'SCAN_IN'
  | 'SCAN_OUT'
  | 'BULK_STOCK_IN'
  | 'UPDATE_ITEM'
  | 'DELETE_ITEM'
  | 'DELETE_LOG'
  | 'LOGIN'
  | 'GET_USERS'
  | 'CREATE_USER'
  | 'DELETE_USER'
  | 'GET_CUSTOMERS'
  | 'SAVE_CUSTOMER'
  | 'DELETE_CUSTOMER';

export type SheetApiResponse = {
  success: boolean;
  message?: string;
  count?: number;
  item?: SheetStockItem;
  importedItems?: SheetStockItem[];
  items?: SheetStockItem[];
  logs?: SheetTransaction[];
  user?: SheetUser;
  users?: SheetUser[];
  customer?: Customer;
  customers?: Customer[];
};

const DEFAULT_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbzRjY7fIZtlD3Kw7OM1MaLmgomYtkY9FXmvV4uzUeeuB6v8zKYQ83KL4mtnIc-U6Nqm/exec';

const ENV_URL = (import.meta.env.VITE_GOOGLE_SHEET_URL || DEFAULT_SHEET_URL).trim();

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
  const totalIn = roundQty(Number(raw.totalIn) || 0);
  const totalOut = roundQty(Number(raw.totalOut) || 0);
  const rawStock = raw.stock;
  let stock = roundQty(Number(rawStock) || 0);

  // If Remaining Stock cell was left blank on manually pasted Google Sheet rows, compute Total IN - Total OUT
  if (
    (rawStock === undefined || rawStock === null || (stock === 0 && !raw.updatedBy)) &&
    totalIn > totalOut
  ) {
    stock = roundQty(Math.max(0, totalIn - totalOut));
  }

  const rawPriceVal = (raw as Record<string, unknown>).price;
  const rawPrice =
    rawPriceVal !== undefined && rawPriceVal !== null && rawPriceVal !== ''
      ? Number(rawPriceVal)
      : undefined;
  const price =
    rawPrice !== undefined && !isNaN(rawPrice) && rawPrice >= 0 && rawPrice < 100000000000
      ? roundQty(rawPrice)
      : undefined;

  return {
    barcode: String(raw.barcode || '').trim(),
    name: String(raw.name || '').trim(),
    size: String(raw.size || '').trim(),
    color: String(raw.color || '').trim(),
    price,
    totalIn,
    totalOut,
    stock,
    unit: normalizeUnit(raw.unit),
    updatedBy: String(raw.updatedBy || '').trim(),
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

function normalizeLog(raw: Partial<SheetTransaction>): SheetTransaction {
  const rawPriceVal = (raw as Record<string, unknown>).price;
  const rawPrice =
    rawPriceVal !== undefined && rawPriceVal !== null && rawPriceVal !== ''
      ? Number(rawPriceVal)
      : undefined;
  const price =
    rawPrice !== undefined && !isNaN(rawPrice) && rawPrice >= 0 && rawPrice < 100000000000
      ? roundQty(rawPrice)
      : undefined;
  const qty = roundQty(Number(raw.qty) || 0);
  const rawTotalVal = (raw as Record<string, unknown>).totalAmount;
  const rawTotal =
    rawTotalVal !== undefined && rawTotalVal !== null && rawTotalVal !== ''
      ? Number(rawTotalVal)
      : price !== undefined
      ? price * qty
      : undefined;
  const totalAmount = rawTotal !== undefined && !isNaN(rawTotal) ? roundQty(rawTotal) : undefined;

  return {
    id: String(raw.id || ''),
    type: raw.type === 'OUT' ? 'OUT' : 'IN',
    barcode: String(raw.barcode || '').trim(),
    name: String(raw.name || '').trim(),
    size: String(raw.size || '').trim(),
    color: String(raw.color || '').trim(),
    qty,
    unit: normalizeUnit(raw.unit),
    price,
    totalAmount,
    source: raw.source || 'MANUAL',
    doneBy: String(raw.doneBy || '').trim(),
    customerName: String(raw.customerName || '').trim(),
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
