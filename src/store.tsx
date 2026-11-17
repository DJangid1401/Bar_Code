import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Transaction = {
  id: string;
  type: 'IN' | 'OUT';
  barcode: string;
  name: string;
  timestamp: number;
};

export type StockItem = {
  barcode: string;
  name: string;
  stock: number;
};

interface AppState {
  items: StockItem[];
  logs: Transaction[];
  scanIn: (barcode: string, name: string) => void;
  scanOut: (barcode: string) => { success: boolean; message: string };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      items: [],
      logs: [],
      scanIn: (barcode, name) => {
        const { items, logs } = get();
        const existing = items.find(i => i.barcode === barcode);
        const newItems = existing 
          ? items.map(i => i.barcode === barcode ? { ...i, stock: i.stock + 1 } : i)
          : [...items, { barcode, name, stock: 1 }];
        
        const newLog: Transaction = { id: Date.now().toString(), type: 'IN', barcode, name, timestamp: Date.now() };
        set({ items: newItems, logs: [newLog, ...logs] });
      },
      scanOut: (barcode) => {
        const { items, logs } = get();
        const existing = items.find(i => i.barcode === barcode);
        if (!existing) return { success: false, message: 'Error: Ye item system mein nahi hai!' };
        if (existing.stock <= 0) return { success: false, message: `Error: ${existing.name} ka stock 0 hai!` };

        const newItems = items.map(i => i.barcode === barcode ? { ...i, stock: i.stock - 1 } : i);
        const newLog: Transaction = { id: Date.now().toString(), type: 'OUT', barcode, name: existing.name, timestamp: Date.now() };
        set({ items: newItems, logs: [newLog, ...logs] });
        return { success: true, message: `Success: 1 ${existing.name} OUT ho gaya!` };
      }
    }),
    { name: 'simple-qr-inventory' }
  )
);