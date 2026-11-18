import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AllowedUnit, normalizeUnit } from './utils/qrHelper';

export type Transaction = {
  id: string;
  type: 'IN' | 'OUT';
  barcode: string;
  name: string;
  size?: string;
  color?: string;
  qty: number;
  unit?: AllowedUnit;
  source?: 'SCAN' | 'MANUAL' | 'EXCEL_IMPORT';
  timestamp: number;
};

export type StockItem = {
  barcode: string;
  name: string;
  size: string;
  color: string;
  stock: number;
  unit: AllowedUnit;
  createdAt?: number;
  updatedAt?: number;
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
  ) => { success: boolean; message: string; item?: StockItem };
  scanOut: (
    payloadOrBarcode: ScanOutPayload | string,
    fallbackQty?: number
  ) => { success: boolean; message: string };
  bulkStockIn: (
    entries: Array<{
      barcode: string;
      name: string;
      size?: string;
      color?: string;
      qty: number;
      unit?: string;
    }>
  ) => { count: number; message: string; importedItems: StockItem[] };
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

        if (!barcode) return { success: false, message: 'Manual Product Code / Unique Code dalna zaroori hai!' };
        if (!name) return { success: false, message: 'Product Name dalna zaroori hai!' };

        const { items, logs } = get();
        const existing = items.find(
          i => i.barcode.toLowerCase() === barcode.toLowerCase()
        );
        const now = Date.now();

        let savedItem: StockItem;
        let newItems: StockItem[];
        if (existing) {
          savedItem = {
            ...existing,
            name: name || existing.name,
            size: size || existing.size || '',
            color: color || existing.color || '',
            unit: normalizeUnit(unit || existing.unit),
            stock: existing.stock + qty,
            updatedAt: now,
          };
          newItems = items.map(i =>
            i.barcode.toLowerCase() === barcode.toLowerCase() ? savedItem : i
          );
        } else {
          savedItem = {
            barcode,
            name,
            size: size || '',
            color: color || '',
            stock: qty,
            unit,
            createdAt: now,
            updatedAt: now,
          };
          newItems = [...items, savedItem];
        }

        const newLog: Transaction = {
          id: now.toString() + Math.random().toString(36).substring(2, 6),
          type: 'IN',
          barcode: savedItem.barcode,
          name: savedItem.name,
          size: savedItem.size,
          color: savedItem.color,
          qty,
          unit: savedItem.unit,
          source,
          timestamp: now,
        };

        set({ items: newItems, logs: [newLog, ...logs] });
        return {
          success: true,
          message: `Success: +${qty} ${savedItem.unit} ${savedItem.name} Stock IN Done!`,
          item: savedItem,
        };
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

        if (!barcode) return { success: false, message: 'Product Code dalna zaroori hai!' };

        const { items, logs } = get();
        const existing = items.find(
          i => i.barcode.toLowerCase() === barcode.toLowerCase()
        );
        if (!existing) {
          return { success: false, message: 'Error: Ye item system mein nahi hai!' };
        }

        const unit = normalizeUnit(existing.unit);

        if (existing.stock < qty) {
          return {
            success: false,
            message: `Error: Stock kam hai! Available: ${existing.stock} ${unit}, Requested: ${qty}`,
          };
        }

        const now = Date.now();
        const newItems = items.map(i =>
          i.barcode.toLowerCase() === barcode.toLowerCase()
            ? { ...i, stock: i.stock - qty, unit, updatedAt: now }
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
          unit,
          source: 'MANUAL',
          timestamp: now,
        };

        set({ items: newItems, logs: [newLog, ...logs] });
        return {
          success: true,
          message: `Success: -${qty} ${unit} ${existing.name} OUT ho gaya!`,
        };
      },

      bulkStockIn: entries => {
        const { items, logs } = get();
        const currentItems = [...items];
        const newLogs: Transaction[] = [];
        const importedMap = new Map<string, StockItem>();
        const now = Date.now();
        let processedCount = 0;

        for (let idx = 0; idx < entries.length; idx++) {
          const entry = entries[idx];
          const barcode = (entry.barcode || '').trim();
          const name = (entry.name || '').trim();
          // Strict manual code requirement: skip if barcode or name missing
          if (!barcode || !name) continue;

          const qty = Number(entry.qty) > 0 ? Number(entry.qty) : 1;
          const size = (entry.size || '').trim();
          const color = (entry.color || '').trim();
          const unit = normalizeUnit(entry.unit);

          const existingIndex = currentItems.findIndex(
            i => i.barcode.toLowerCase() === barcode.toLowerCase()
          );

          let savedItem: StockItem;
          if (existingIndex >= 0) {
            const existing = currentItems[existingIndex];
            savedItem = {
              ...existing,
              name: name || existing.name,
              size: size || existing.size || '',
              color: color || existing.color || '',
              unit: normalizeUnit(unit || existing.unit),
              stock: existing.stock + qty,
              updatedAt: now + idx,
            };
            currentItems[existingIndex] = savedItem;
          } else {
            savedItem = {
              barcode,
              name,
              size,
              color,
              stock: qty,
              unit,
              createdAt: now + idx,
              updatedAt: now + idx,
            };
            currentItems.push(savedItem);
          }

          importedMap.set(savedItem.barcode.toLowerCase(), savedItem);

          newLogs.push({
            id: (now + idx).toString() + Math.random().toString(36).substring(2, 6),
            type: 'IN',
            barcode: savedItem.barcode,
            name: savedItem.name,
            size: savedItem.size,
            color: savedItem.color,
            qty,
            unit: savedItem.unit,
            source: 'EXCEL_IMPORT',
            timestamp: now + idx,
          });

          processedCount++;
        }

        set({ items: currentItems, logs: [...newLogs.reverse(), ...logs] });
        return {
          count: processedCount,
          message: `Success: ${processedCount} items Excel/CSV se Stock IN ho gaye! QR codes ready hain.`,
          importedItems: Array.from(importedMap.values()),
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
                unit: normalizeUnit(updatedData.unit ?? i.unit),
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
