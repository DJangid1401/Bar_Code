import { create } from 'zustand';
import {
  fetchGoogleSheetData,
  postGoogleSheetAction,
  isGoogleSheetConfigured,
  SheetStockItem,
  SheetTransaction,
} from './services/googleSheets';
import { AllowedUnit, normalizeUnit } from './utils/qrHelper';

export type Transaction = SheetTransaction;
export type StockItem = SheetStockItem;

export type ScanInPayload = {
  barcode: string;
  name: string;
  qty?: number;
  size?: string;
  color?: string;
  unit?: string;
  source?: 'SCAN' | 'MANUAL' | 'EXCEL_IMPORT';
};

export type ScanOutPayload = {
  barcode: string;
  qty?: number;
};

function extractError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return 'Request timed out. Google Sheet did not respond in time. Please try again.';
    }
    if (err.message === 'Failed to fetch') {
      return 'Could not connect to Google Sheet (CORS blocked). Ensure Apps Script is deployed with "Who has access: Anyone" and a New version is published.';
    }
    return err.message;
  }
  return err ? String(err) : fallback;
}

interface AppState {
  items: StockItem[];
  logs: Transaction[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  error: string | null;
  isConfigured: boolean;
  clearError: () => void;
  fetchData: (silent?: boolean) => Promise<void>;
  startAutoSync: (intervalMs?: number) => () => void;
  scanIn: (
    payloadOrBarcode: ScanInPayload | string,
    fallbackName?: string
  ) => Promise<{ success: boolean; message: string; item?: StockItem }>;
  scanOut: (
    payloadOrBarcode: ScanOutPayload | string,
    fallbackQty?: number
  ) => Promise<{ success: boolean; message: string }>;
  bulkStockIn: (
    entries: Array<{
      barcode: string;
      name: string;
      size?: string;
      color?: string;
      qty: number;
      unit?: string;
    }>
  ) => Promise<{ count: number; message: string; importedItems: StockItem[] }>;
  updateItem: (
    barcode: string,
    updatedData: Partial<Omit<StockItem, 'barcode'>>
  ) => Promise<{ success: boolean; message: string }>;
  deleteItem: (barcode: string) => Promise<{ success: boolean; message: string }>;
  deleteLog: (id: string) => Promise<{ success: boolean; message: string }>;
}

export const useStore = create<AppState>()((set, get) => ({
  items: [],
  logs: [],
  isLoading: false,
  isSyncing: false,
  lastSyncedAt: null,
  error: null,
  isConfigured: isGoogleSheetConfigured(),

  clearError: () => set({ error: null }),

  fetchData: async (silent = false) => {
    if (!isGoogleSheetConfigured()) {
      set({
        isLoading: false,
        isConfigured: false,
        error:
          'Google Sheet Web App URL is not configured. Please add VITE_GOOGLE_SHEET_URL in .env.local.',
      });
      return;
    }

    if (!silent) {
      set({ isLoading: true, error: null });
    }

    try {
      const { items, logs } = await fetchGoogleSheetData();
      set({
        items,
        logs,
        isLoading: false,
        isConfigured: true,
        lastSyncedAt: Date.now(),
        error: null,
      });
    } catch (err) {
      const message = extractError(err, 'Failed to load data from Google Sheet.');
      console.error('Google Sheets fetchData error:', err);
      set({
        isLoading: false,
        error: message,
      });
    }
  },

  startAutoSync: (intervalMs = 15000) => {
    if (!isGoogleSheetConfigured()) return () => {};

    const timer = window.setInterval(() => {
      const state = get();
      if (document.visibilityState === 'visible' && !state.isSyncing && !state.isLoading) {
        state.fetchData(true);
      }
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  },

  scanIn: async (payloadOrBarcode, fallbackName) => {
    if (!isGoogleSheetConfigured()) {
      return {
        success: false,
        message: 'Google Sheet URL is not configured. Please set VITE_GOOGLE_SHEET_URL in .env.local.',
      };
    }

    let barcode = '';
    let name = '';
    let qty = 1;
    let size = '';
    let color = '';
    let unit: AllowedUnit = 'PCS';
    let source: 'SCAN' | 'MANUAL' | 'EXCEL_IMPORT' = 'MANUAL';

    if (typeof payloadOrBarcode === 'string') {
      barcode = payloadOrBarcode.trim();
      name = (fallbackName || '').trim();
    } else {
      barcode = (payloadOrBarcode.barcode || '').trim();
      name = (payloadOrBarcode.name || '').trim();
      qty = Number(payloadOrBarcode.qty) > 0 ? Number(payloadOrBarcode.qty) : 1;
      size = (payloadOrBarcode.size || '').trim();
      color = (payloadOrBarcode.color || '').trim();
      unit = normalizeUnit(payloadOrBarcode.unit);
      source = payloadOrBarcode.source || 'MANUAL';
    }

    if (!barcode) {
      return { success: false, message: 'Unique Product Code is required.' };
    }
    if (!name) {
      return { success: false, message: 'Product Name is required.' };
    }

    set({ isSyncing: true, error: null });
    try {
      const res = await postGoogleSheetAction('SCAN_IN', {
        barcode,
        name,
        qty,
        size,
        color,
        unit,
        source,
      });

      set({
        items: res.items ?? get().items,
        logs: res.logs ?? get().logs,
        lastSyncedAt: Date.now(),
        isSyncing: false,
      });

      return {
        success: true,
        message: `Success: +${qty} ${unit} of "${name}" added to Stock IN.`,
        item: res.item,
      };
    } catch (err) {
      const message = extractError(err, 'Failed to save Stock IN entry.');
      console.error('Google Sheets scanIn error:', err);
      set({ isSyncing: false, error: message });
      return { success: false, message: `Error: ${message}` };
    }
  },

  scanOut: async (payloadOrBarcode, fallbackQty) => {
    if (!isGoogleSheetConfigured()) {
      return {
        success: false,
        message: 'Google Sheet URL is not configured. Please set VITE_GOOGLE_SHEET_URL in .env.local.',
      };
    }

    let barcode = '';
    let qty = 1;

    if (typeof payloadOrBarcode === 'string') {
      barcode = payloadOrBarcode.trim();
      qty = Number(fallbackQty) > 0 ? Number(fallbackQty) : 1;
    } else {
      barcode = (payloadOrBarcode.barcode || '').trim();
      qty = Number(payloadOrBarcode.qty) > 0 ? Number(payloadOrBarcode.qty) : 1;
    }

    if (!barcode) {
      return { success: false, message: 'Unique Product Code is required.' };
    }

    set({ isSyncing: true, error: null });
    try {
      const res = await postGoogleSheetAction('SCAN_OUT', {
        barcode,
        qty,
      });

      set({
        items: res.items ?? get().items,
        logs: res.logs ?? get().logs,
        lastSyncedAt: Date.now(),
        isSyncing: false,
      });

      return {
        success: true,
        message: `Success: -${qty} dispatched from stock.`,
      };
    } catch (err) {
      const message = extractError(err, 'Failed to save Stock OUT entry.');
      console.error('Google Sheets scanOut error:', err);
      set({ isSyncing: false, error: message });
      return { success: false, message: `Error: ${message}` };
    }
  },

  bulkStockIn: async entries => {
    if (!isGoogleSheetConfigured()) {
      return {
        count: 0,
        message: 'Google Sheet URL is not configured. Please set VITE_GOOGLE_SHEET_URL in .env.local.',
        importedItems: [],
      };
    }

    set({ isSyncing: true, error: null });
    try {
      const res = await postGoogleSheetAction('BULK_STOCK_IN', {
        entries,
      });

      set({
        items: res.items ?? get().items,
        logs: res.logs ?? get().logs,
        lastSyncedAt: Date.now(),
        isSyncing: false,
      });

      const count = res.count ?? (res.importedItems?.length || 0);
      return {
        count,
        message: `Success: ${count} item(s) imported into Google Sheet as Stock IN.`,
        importedItems: res.importedItems || [],
      };
    } catch (err) {
      const message = extractError(err, 'Failed to import Excel/CSV into Google Sheet.');
      console.error('Google Sheets bulkStockIn error:', err);
      set({ isSyncing: false, error: message });
      return {
        count: 0,
        message: `Error: ${message}`,
        importedItems: [],
      };
    }
  },

  updateItem: async (barcode, updatedData) => {
    if (!isGoogleSheetConfigured()) {
      return {
        success: false,
        message: 'Google Sheet URL is not configured. Please set VITE_GOOGLE_SHEET_URL in .env.local.',
      };
    }

    set({ isSyncing: true, error: null });
    try {
      const res = await postGoogleSheetAction('UPDATE_ITEM', {
        barcode,
        ...updatedData,
        unit: updatedData.unit ? normalizeUnit(updatedData.unit) : undefined,
      });

      set({
        items: res.items ?? get().items,
        logs: res.logs ?? get().logs,
        lastSyncedAt: Date.now(),
        isSyncing: false,
      });

      return {
        success: true,
        message: 'Product updated successfully.',
      };
    } catch (err) {
      const message = extractError(err, 'Failed to update product.');
      console.error('Google Sheets updateItem error:', err);
      set({ isSyncing: false, error: message });
      return { success: false, message: `Error: ${message}` };
    }
  },

  deleteItem: async barcode => {
    if (!isGoogleSheetConfigured()) {
      return {
        success: false,
        message: 'Google Sheet URL is not configured. Please set VITE_GOOGLE_SHEET_URL in .env.local.',
      };
    }

    set({ isSyncing: true, error: null });
    try {
      const res = await postGoogleSheetAction('DELETE_ITEM', { barcode });

      set({
        items: res.items ?? get().items,
        logs: res.logs ?? get().logs,
        lastSyncedAt: Date.now(),
        isSyncing: false,
      });

      return {
        success: true,
        message: 'Product deleted from inventory.',
      };
    } catch (err) {
      const message = extractError(err, 'Failed to delete product.');
      console.error('Google Sheets deleteItem error:', err);
      set({ isSyncing: false, error: message });
      return { success: false, message: `Error: ${message}` };
    }
  },

  deleteLog: async id => {
    if (!isGoogleSheetConfigured()) {
      return {
        success: false,
        message: 'Google Sheet URL is not configured. Please set VITE_GOOGLE_SHEET_URL in .env.local.',
      };
    }

    set({ isSyncing: true, error: null });
    try {
      const res = await postGoogleSheetAction('DELETE_LOG', { id });

      set({
        items: res.items ?? get().items,
        logs: res.logs ?? get().logs,
        lastSyncedAt: Date.now(),
        isSyncing: false,
      });

      return {
        success: true,
        message: 'Transaction log deleted.',
      };
    } catch (err) {
      const message = extractError(err, 'Failed to delete transaction log.');
      console.error('Google Sheets deleteLog error:', err);
      set({ isSyncing: false, error: message });
      return { success: false, message: `Error: ${message}` };
    }
  },
}));
