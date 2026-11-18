import { create } from 'zustand';
import {
  fetchGoogleSheetData,
  postGoogleSheetAction,
  isGoogleSheetConfigured,
  SheetStockItem,
  SheetTransaction,
  SheetUser,
} from './services/googleSheets';
import { AllowedUnit, normalizeUnit, roundQty } from './utils/qrHelper';

export type Transaction = SheetTransaction;
export type StockItem = SheetStockItem;
export type AppUser = SheetUser;

const SESSION_KEY = 'qr_inventory_active_user';

function loadSavedUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser;
    if (parsed && parsed.username && parsed.name) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveUserSession(user: AppUser | null) {
  try {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

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
      return 'Request timed out. Please try again.';
    }
    if (err.message === 'Failed to fetch') {
      return 'Could not connect to server. Please check your internet connection and try again.';
    }
    return err.message;
  }
  return err ? String(err) : fallback;
}

interface AppState {
  items: StockItem[];
  logs: Transaction[];
  users: AppUser[];
  currentUser: AppUser | null;
  isLoading: boolean;
  isSyncing: boolean;
  isUsersLoading: boolean;
  lastSyncedAt: number | null;
  error: string | null;
  isConfigured: boolean;
  clearError: () => void;
  login: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  fetchUsers: () => Promise<void>;
  createUser: (data: {
    name: string;
    username: string;
    password: string;
    role: 'Admin' | 'Staff';
  }) => Promise<{ success: boolean; message: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; message: string }>;
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
  users: [],
  currentUser: loadSavedUser(),
  isLoading: false,
  isSyncing: false,
  isUsersLoading: false,
  lastSyncedAt: null,
  error: null,
  isConfigured: isGoogleSheetConfigured(),

  clearError: () => set({ error: null }),

  login: async (username, password) => {
    const cleanUser = username.trim();
    const cleanPass = password.trim();
    if (!cleanUser || !cleanPass) {
      return { success: false, message: 'Please enter both Login ID and Password.' };
    }

    set({ isSyncing: true, error: null });
    try {
      const res = await postGoogleSheetAction('LOGIN', {
        username: cleanUser,
        password: cleanPass,
      });

      if (res.user) {
        saveUserSession(res.user);
        set({ currentUser: res.user, isSyncing: false });
        return { success: true, message: `Welcome, ${res.user.name}!` };
      }

      set({ isSyncing: false });
      return { success: false, message: res.message || 'Invalid Login ID or Password.' };
    } catch (err) {
      const message = extractError(err, 'Login failed.');
      // Graceful fallback if Apps Script hasn't been updated with LOGIN action yet
      if (
        message.includes('Unknown action: LOGIN') &&
        cleanUser.toLowerCase() === 'admin' &&
        cleanPass === 'admin123'
      ) {
        const fallbackAdmin: AppUser = {
          id: 'admin-default',
          name: 'Admin',
          username: 'admin',
          role: 'Admin',
        };
        saveUserSession(fallbackAdmin);
        set({ currentUser: fallbackAdmin, isSyncing: false });
        return { success: true, message: 'Welcome, Admin!' };
      }

      set({ isSyncing: false });
      return { success: false, message };
    }
  },

  logout: () => {
    saveUserSession(null);
    set({ currentUser: null, users: [] });
  },

  fetchUsers: async () => {
    if (!isGoogleSheetConfigured()) return;
    set({ isUsersLoading: true });
    try {
      const res = await postGoogleSheetAction('GET_USERS', {});
      set({ users: res.users || [], isUsersLoading: false });
    } catch (err) {
      const msg = extractError(err, 'Failed to load users.');
      console.error('fetchUsers error:', err);
      set({ isUsersLoading: false, error: msg });
    }
  },

  createUser: async data => {
    if (!isGoogleSheetConfigured()) {
      return { success: false, message: 'Server connection is not configured.' };
    }
    set({ isSyncing: true, error: null });
    try {
      const res = await postGoogleSheetAction('CREATE_USER', data);
      set({ users: res.users || get().users, isSyncing: false });
      return { success: true, message: res.message || 'User created successfully.' };
    } catch (err) {
      const message = extractError(err, 'Failed to create user.');
      set({ isSyncing: false, error: message });
      return { success: false, message };
    }
  },

  deleteUser: async id => {
    if (!isGoogleSheetConfigured()) {
      return { success: false, message: 'Server connection is not configured.' };
    }
    set({ isSyncing: true, error: null });
    try {
      const res = await postGoogleSheetAction('DELETE_USER', { id });
      set({ users: res.users || get().users.filter(u => u.id !== id), isSyncing: false });
      return { success: true, message: res.message || 'User deleted successfully.' };
    } catch (err) {
      const message = extractError(err, 'Failed to delete user.');
      set({ isSyncing: false, error: message });
      return { success: false, message };
    }
  },

  fetchData: async (silent = false) => {
    if (!isGoogleSheetConfigured()) {
      set({
        isLoading: false,
        isConfigured: false,
        error: 'Cloud backend URL is not configured.',
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
      const message = extractError(err, 'Failed to load inventory data.');
      console.error('fetchData error:', err);
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
      if (
        state.currentUser &&
        document.visibilityState === 'visible' &&
        !state.isSyncing &&
        !state.isLoading
      ) {
        state.fetchData(true);
      }
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  },

  scanIn: async (payloadOrBarcode, fallbackName) => {
    if (!isGoogleSheetConfigured()) {
      return { success: false, message: 'Cloud backend is not configured.' };
    }

    let barcode = '';
    let name = '';
    let qty = 1;
    let size = '';
    let color = '';
    let unit: AllowedUnit = 'KGS';
    let source: 'SCAN' | 'MANUAL' | 'EXCEL_IMPORT' = 'MANUAL';

    if (typeof payloadOrBarcode === 'string') {
      barcode = payloadOrBarcode.trim();
      name = (fallbackName || '').trim();
    } else {
      barcode = (payloadOrBarcode.barcode || '').trim();
      name = (payloadOrBarcode.name || '').trim();
      qty = roundQty(Number(payloadOrBarcode.qty) > 0 ? Number(payloadOrBarcode.qty) : 0);
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
    if (qty <= 0) {
      return { success: false, message: 'Quantity must be greater than 0.' };
    }

    const doneBy = get().currentUser?.name || 'Admin';

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
        doneBy,
      });

      set({
        items: res.items ?? get().items,
        logs: res.logs ?? get().logs,
        lastSyncedAt: Date.now(),
        isSyncing: false,
      });

      return {
        success: true,
        message: `Success: +${qty} ${unit} of "${name}" added to Stock IN by ${doneBy}.`,
        item: res.item,
      };
    } catch (err) {
      const message = extractError(err, 'Failed to save Stock IN entry.');
      console.error('scanIn error:', err);
      set({ isSyncing: false, error: message });
      return { success: false, message: `Error: ${message}` };
    }
  },

  scanOut: async (payloadOrBarcode, fallbackQty) => {
    if (!isGoogleSheetConfigured()) {
      return { success: false, message: 'Cloud backend is not configured.' };
    }

    let barcode = '';
    let qty = 1;

    if (typeof payloadOrBarcode === 'string') {
      barcode = payloadOrBarcode.trim();
      qty = roundQty(Number(fallbackQty) > 0 ? Number(fallbackQty) : 0);
    } else {
      barcode = (payloadOrBarcode.barcode || '').trim();
      qty = roundQty(Number(payloadOrBarcode.qty) > 0 ? Number(payloadOrBarcode.qty) : 0);
    }

    if (!barcode) {
      return { success: false, message: 'Unique Product Code is required.' };
    }
    if (qty <= 0) {
      return { success: false, message: 'Dispatch quantity must be greater than 0.' };
    }

    const doneBy = get().currentUser?.name || 'Admin';

    set({ isSyncing: true, error: null });
    try {
      const res = await postGoogleSheetAction('SCAN_OUT', {
        barcode,
        qty,
        doneBy,
      });

      set({
        items: res.items ?? get().items,
        logs: res.logs ?? get().logs,
        lastSyncedAt: Date.now(),
        isSyncing: false,
      });

      return {
        success: true,
        message: res.message || `Success: -${qty} dispatched by ${doneBy}.`,
      };
    } catch (err) {
      const message = extractError(err, 'Failed to save Stock OUT entry.');
      console.error('scanOut error:', err);
      set({ isSyncing: false, error: message });
      return { success: false, message: `Error: ${message}` };
    }
  },

  bulkStockIn: async entries => {
    if (!isGoogleSheetConfigured()) {
      return {
        count: 0,
        message: 'Cloud backend is not configured.',
        importedItems: [],
      };
    }

    const doneBy = get().currentUser?.name || 'Admin';

    set({ isSyncing: true, error: null });
    try {
      const res = await postGoogleSheetAction('BULK_STOCK_IN', {
        entries,
        doneBy,
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
        message: `Success: ${count} item(s) imported as Stock IN by ${doneBy}.`,
        importedItems: res.importedItems || [],
      };
    } catch (err) {
      const message = extractError(err, 'Failed to import Excel/CSV.');
      console.error('bulkStockIn error:', err);
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
      return { success: false, message: 'Cloud backend is not configured.' };
    }

    const updatedBy = get().currentUser?.name || 'Admin';

    set({ isSyncing: true, error: null });
    try {
      const res = await postGoogleSheetAction('UPDATE_ITEM', {
        barcode,
        ...updatedData,
        unit: updatedData.unit ? normalizeUnit(updatedData.unit) : undefined,
        updatedBy,
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
      console.error('updateItem error:', err);
      set({ isSyncing: false, error: message });
      return { success: false, message: `Error: ${message}` };
    }
  },

  deleteItem: async barcode => {
    if (!isGoogleSheetConfigured()) {
      return { success: false, message: 'Cloud backend is not configured.' };
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
      console.error('deleteItem error:', err);
      set({ isSyncing: false, error: message });
      return { success: false, message: `Error: ${message}` };
    }
  },

  deleteLog: async id => {
    if (!isGoogleSheetConfigured()) {
      return { success: false, message: 'Cloud backend is not configured.' };
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
      console.error('deleteLog error:', err);
      set({ isSyncing: false, error: message });
      return { success: false, message: `Error: ${message}` };
    }
  },
}));
