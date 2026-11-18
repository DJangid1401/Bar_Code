import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Transaction = {
  id: string;
  type: 'IN' | 'OUT';
  barcode: string;
  name: string;
  size?: string;
  color?: string;
  qty: number;
  unit?: string;
  source?: 'SCAN' | 'MANUAL' | 'EXCEL_IMPORT';
  timestamp: number;
};

export type StockItem = {
  barcode: string;
  name: string;
  size: string;
  color: string;
  stock: number;
  unit: string;
  createdAt?: number;
  updatedAt?: number;
};

export const generateUniqueCode = (existingBarcodes?: string[]): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const existingSet = new Set((existingBarcodes || []).map(b => b.toUpperCase()));
  do {
    let rand = '';
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = `PRD-${rand}`;
  } while (existingSet.has(code));
  return code;
};

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

interface AppState {
  items: StockItem[];
  logs: Transaction[];
  scanIn: (
    payloadOrBarcode: ScanInPayload | string,
    fallbackName?: string
  ) => { success: boolean; message: string };
  scanOut: (
    payloadOrBarcode: ScanOutPayload | string,
    fallbackQty?: number
  ) => { success: boolean; message: string };
  bulkStockIn: (
    entries: Array<{
      barcode?: string;
      name: string;
      size?: string;
      color?: string;
      qty: number;
      unit?: string;
    }>
  ) => { count: number; message: string };
  updateItem: (
    barcode: string,
    updatedData: Partial<Omit<StockItem, 'barcode'>>
  ) => { success: boolean; message: string };
  deleteItem: (barcode: string) => { success: boolean; message: string };
  deleteLog: (id: string) => { success: boolean; message: string };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      items: [],
      logs: [],

      scanIn: (payloadOrBarcode, fallbackName) => {
        let barcode = '';
        let name = '';
        let qty = 1;
        let size = '';
        let color = '';
        let unit = 'Pcs';
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
          unit = (payloadOrBarcode.unit || 'Pcs').trim();
          source = payloadOrBarcode.source || 'MANUAL';
        }

        if (!barcode) return { success: false, message: 'Unique code / Barcode zaroori hai!' };
        if (!name) return { success: false, message: 'Product Name zaroori hai!' };

        const { items, logs } = get();
        const existing = items.find(
          i => i.barcode.toLowerCase() === barcode.toLowerCase()
        );
        const now = Date.now();

        let newItems: StockItem[];
        if (existing) {
          newItems = items.map(i =>
            i.barcode.toLowerCase() === barcode.toLowerCase()
              ? {
                  ...i,
                  name: name || i.name,
                  size: size || i.size || '',
                  color: color || i.color || '',
                  unit: unit || i.unit || 'Pcs',
                  stock: i.stock + qty,
                  updatedAt: now,
                }
              : i
          );
        } else {
          newItems = [
            ...items,
            {
              barcode,
              name,
              size: size || '',
              color: color || '',
              stock: qty,
              unit: unit || 'Pcs',
              createdAt: now,
              updatedAt: now,
            },
          ];
        }

        const newLog: Transaction = {
          id: now.toString() + Math.random().toString(36).substring(2, 6),
          type: 'IN',
          barcode,
          name,
          size: size || existing?.size || '',
          color: color || existing?.color || '',
          qty,
          unit: unit || existing?.unit || 'Pcs',
          source,
          timestamp: now,
        };

        set({ items: newItems, logs: [newLog, ...logs] });
        return { success: true, message: `Success: +${qty} ${name} Stock IN Done!` };
      },

      scanOut: (payloadOrBarcode, fallbackQty) => {
        let barcode = '';
        let qty = 1;

        if (typeof payloadOrBarcode === 'string') {
          barcode = payloadOrBarcode.trim();
          qty = Number(fallbackQty) > 0 ? Number(fallbackQty) : 1;
        } else {
          barcode = (payloadOrBarcode.barcode || '').trim();
          qty = Number(payloadOrBarcode.qty) > 0 ? Number(payloadOrBarcode.qty) : 1;
        }

        if (!barcode) return { success: false, message: 'Barcode dalna zaroori hai!' };

        const { items, logs } = get();
        const existing = items.find(
          i => i.barcode.toLowerCase() === barcode.toLowerCase()
        );
        if (!existing) {
          return { success: false, message: 'Error: Ye item system mein nahi hai!' };
        }

        if (existing.stock < qty) {
          return {
            success: false,
            message: `Error: Stock kam hai! Available: ${existing.stock} ${existing.unit || 'Pcs'}, Requested: ${qty}`,
          };
        }

        const now = Date.now();
        const newItems = items.map(i =>
          i.barcode.toLowerCase() === barcode.toLowerCase()
            ? { ...i, stock: i.stock - qty, updatedAt: now }
            : i
        );

        const newLog: Transaction = {
          id: now.toString() + Math.random().toString(36).substring(2, 6),
          type: 'OUT',
          barcode: existing.barcode,
          name: existing.name,
          size: existing.size,
          color: existing.color,
          qty,
          unit: existing.unit,
          source: 'MANUAL',
          timestamp: now,
        };

        set({ items: newItems, logs: [newLog, ...logs] });
        return {
          success: true,
          message: `Success: -${qty} ${existing.name} OUT ho gaya!`,
        };
      },

      bulkStockIn: entries => {
        const { items, logs } = get();
        const currentItems = [...items];
        const newLogs: Transaction[] = [];
        const now = Date.now();
        let processedCount = 0;

        for (let idx = 0; idx < entries.length; idx++) {
          const entry = entries[idx];
          const name = (entry.name || '').trim();
          if (!name) continue;

          const qty = Number(entry.qty) > 0 ? Number(entry.qty) : 1;
          const size = (entry.size || '').trim();
          const color = (entry.color || '').trim();
          const unit = (entry.unit || 'Pcs').trim();

          let barcode = (entry.barcode || '').trim();
          if (!barcode) {
            const existingCodes = currentItems.map(i => i.barcode);
            barcode = generateUniqueCode(existingCodes);
          }

          const existingIndex = currentItems.findIndex(
            i => i.barcode.toLowerCase() === barcode.toLowerCase()
          );

          if (existingIndex >= 0) {
            const existing = currentItems[existingIndex];
            currentItems[existingIndex] = {
              ...existing,
              name: name || existing.name,
              size: size || existing.size || '',
              color: color || existing.color || '',
              unit: unit || existing.unit || 'Pcs',
              stock: existing.stock + qty,
              updatedAt: now + idx,
            };
          } else {
            currentItems.push({
              barcode,
              name,
              size,
              color,
              stock: qty,
              unit,
              createdAt: now + idx,
              updatedAt: now + idx,
            });
          }

          newLogs.push({
            id: (now + idx).toString() + Math.random().toString(36).substring(2, 6),
            type: 'IN',
            barcode,
            name,
            size,
            color,
            qty,
            unit,
            source: 'EXCEL_IMPORT',
            timestamp: now + idx,
          });

          processedCount++;
        }

        set({ items: currentItems, logs: [...newLogs.reverse(), ...logs] });
        return {
          count: processedCount,
          message: `Success: ${processedCount} items Excel/CSV se Stock IN ho gaye!`,
        };
      },

      updateItem: (barcode, updatedData) => {
        const { items } = get();
        const existing = items.find(i => i.barcode === barcode);
        if (!existing) return { success: false, message: 'Item not found!' };

        const newItems = items.map(i =>
          i.barcode === barcode
            ? {
                ...i,
                ...updatedData,
                stock:
                  typeof updatedData.stock === 'number'
                    ? Math.max(0, updatedData.stock)
                    : i.stock,
                updatedAt: Date.now(),
              }
            : i
        );

        set({ items: newItems });
        return {
          success: true,
          message: `Product "${existing.name}" successfully update ho gaya!`,
        };
      },

      deleteItem: barcode => {
        const { items } = get();
        const existing = items.find(i => i.barcode === barcode);
        if (!existing) return { success: false, message: 'Item not found!' };

        set({ items: items.filter(i => i.barcode !== barcode) });
        return {
          success: true,
          message: `Product "${existing.name}" inventory se delete ho gaya.`,
        };
      },

      deleteLog: id => {
        const { logs } = get();
        set({ logs: logs.filter(l => l.id !== id) });
        return { success: true, message: 'Log delete ho gaya.' };
      },
    }),
    { name: 'simple-qr-inventory' }
  )
);
