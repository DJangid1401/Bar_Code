import { StockItem, Transaction } from '../store';
import { Customer } from '../types/customer';
import { AllowedUnit, normalizeUnit, roundQty } from './qrHelper';

/**
 * MASTER SWITCH FOR DUMMY DEMO DATA:
 * Set this to `false` to permanently remove/hide all 1-year dummy customer data
 * from the Dashboard and Stock OUT autocomplete across the entire app.
 */
export const ENABLE_DEMO_MODE = true;

const DEMO_MODE_STORAGE_KEY = 'swati_demo_mode_enabled';

export function getSavedDemoMode(): boolean {
  if (!ENABLE_DEMO_MODE) return false;
  try {
    const saved = localStorage.getItem(DEMO_MODE_STORAGE_KEY);
    if (saved === 'false') return false;
    if (saved === 'true') return true;
  } catch {
    // ignore storage errors
  }
  return true;
}

export function setSavedDemoMode(enabled: boolean): void {
  try {
    localStorage.setItem(DEMO_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }
}

export function formatColorLabel(color?: string | null): string {
  const cleaned = (color || '').trim();
  if (!cleaned || cleaned.toLowerCase() === 'default' || cleaned.toLowerCase() === 'unspecified color') {
    return 'Fixed';
  }
  return cleaned;
}

// 100 Realistic Dummy Customers
const FIRST_WORDS = [
  'Shree Ganesh',
  'Mahalaxmi',
  'Balaji',
  'Ambika',
  'Navkar',
  'Patel',
  'Sharma',
  'Jain',
  'Arihant',
  'Siddhi',
  'Kesar',
  'Swastik',
  'Riddhi',
  'Surya',
  'Royal',
  'Vardhman',
  'Krishnam',
  'Jay Bhavani',
  'Tirupati',
  'Om Sai',
];

const SECOND_WORDS = [
  'Traders',
  'Enterprises',
  'Craft House',
  'Beads & Jewels',
  'Emporium',
];

export const DUMMY_CUSTOMERS: string[] = (() => {
  const list: string[] = [];
  for (let i = 0; i < FIRST_WORDS.length; i++) {
    for (let j = 0; j < SECOND_WORDS.length; j++) {
      list.push(`${FIRST_WORDS[i]} ${SECOND_WORDS[j]}`);
    }
  }
  return list; // 20 x 5 = exactly 100 unique customers
})();

const INDIAN_STATES = ['27', '24', '08', '07', '23', '06'];
const CITIES = [
  'Kalbadevi, Mumbai - 400002',
  'Ring Road, Surat - 395002',
  'Chandni Chowk, Delhi - 110006',
  'Johari Bazar, Jaipur - 302003',
  'Sarafa Bazar, Indore - 452002',
];

export const DUMMY_CUSTOMER_ACCOUNTS: Customer[] = DUMMY_CUSTOMERS.map((name, idx) => {
  const stateCode = INDIAN_STATES[idx % INDIAN_STATES.length];
  const panPrefix = 'AABC' + String.fromCharCode(65 + (idx % 26));
  const panNum = String(1000 + ((idx * 73) % 8999));
  const panChar = String.fromCharCode(65 + ((idx * 3) % 26));
  const pan = `${panPrefix}${panNum}${panChar}`;
  const gst = `${stateCode}${pan}1Z${(idx % 9) + 1}`;
  const phone = `+91 98${String(10000000 + idx * 79193).slice(0, 8)}`;
  const address = `Shop ${idx + 101}, ${CITIES[idx % CITIES.length]}`;
  return {
    id: `cust-demo-${idx + 1}`,
    name,
    gst,
    phone,
    address,
    pan,
    createdAt: Date.now() - (365 - idx) * 24 * 60 * 60 * 1000,
  };
});

// Deterministic PRNG so 1-year analytics stay stable across re-renders
function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type CatalogEntry = {
  barcode: string;
  name: string;
  size: string;
  color: string;
  price: number;
  unit: AllowedUnit;
};

export const FALLBACK_CATALOG: CatalogEntry[] = [
  { barcode: 'PRD-T001', name: 'TYRE', size: '2.5 MM TYRE', color: 'T-1', price: 240, unit: 'PAC' },
  { barcode: 'PRD-T002', name: 'TYRE', size: '2.5 MM TYRE', color: 'T-7', price: 240, unit: 'PAC' },
  { barcode: 'PRD-T003', name: 'TYRE', size: '2.5 MM TYRE', color: 'T-10', price: 240, unit: 'PAC' },
  { barcode: 'PRD-T004', name: 'TYRE', size: '2.5 MM TYRE', color: 'ML-5', price: 260, unit: 'PAC' },
  { barcode: 'PRD-T005', name: 'TYRE', size: '3.5 MM TYRE', color: 'ML-27', price: 280, unit: 'PAC' },
  { barcode: 'PRD-HM001', name: 'HOLE MOTI', size: '6 MM HOLE MOTI', color: 'T-1', price: 380, unit: 'KGS' },
  { barcode: 'PRD-HM002', name: 'HOLE MOTI', size: '6 MM HOLE MOTI', color: 'T-10', price: 380, unit: 'KGS' },
  { barcode: 'PRD-HM003', name: 'HOLE MOTI', size: '6 MM HOLE MOTI', color: 'ML-5', price: 420, unit: 'KGS' },
  { barcode: 'PRD-HM004', name: 'HOLE MOTI', size: '8 MM HOLE MOTI', color: 'T-19', price: 450, unit: 'KGS' },
  { barcode: 'PRD-GL001', name: 'Globe', size: '4 MM GLOBE', color: 'T-15', price: 520, unit: 'KGS' },
  { barcode: 'PRD-OT001', name: 'Oval Tumble', size: '5 MM OVAL', color: 'N-10', price: 180, unit: 'PAC' },
  { barcode: 'PRD-SJ001', name: 'Small Cut Sujani', size: '3 MM SUJANI', color: 'T-30', price: 340, unit: 'KGS' },
];

const STAFF_NAMES = ['Admin', 'Deepak', 'Sujata'];

export type DemoDataset = {
  items: StockItem[];
  logs: Transaction[];
  customers: string[];
};

/**
 * Generates 1 full year (365 days) of realistic sales/OUT + restock/IN history
 * across 100 dummy customers with exactly 10 customer purchases per day (3,650 orders).
 * Uses the user's actual inventory products/sizes/colors when available.
 */
export function generateOneYearDemoDataset(liveItems: StockItem[]): DemoDataset {
  const rng = createRng(20261118);

  const catalog: CatalogEntry[] =
    liveItems.length >= 4
      ? liveItems.map((i, idx) => ({
          barcode: i.barcode,
          name: i.name,
          size: i.size || 'Standard',
          color: formatColorLabel(i.color),
          price: i.price ?? (normalizeUnit(i.unit) === 'KGS' ? 380 + (idx % 4) * 30 : 220 + (idx % 5) * 20),
          unit: normalizeUnit(i.unit),
        }))
      : FALLBACK_CATALOG;

  // Give products weighted popularity so rankings & pie charts look realistic (not flat uniform)
  const weights = catalog.map((_, idx) => {
    const tier = idx % 5;
    if (tier === 0) return 4.2;
    if (tier === 1) return 2.8;
    if (tier === 2) return 1.8;
    if (tier === 3) return 1.2;
    return 0.7;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const pickWeightedCatalog = (): CatalogEntry => {
    let r = rng() * totalWeight;
    for (let i = 0; i < catalog.length; i++) {
      r -= weights[i];
      if (r <= 0) return catalog[i];
    }
    return catalog[0];
  };

  // Weight customers so top buyers clearly stand out in Top Customers chart
  const pickWeightedCustomer = (): string => {
    const r = rng();
    if (r < 0.35) {
      // Top 15 frequent wholesale buyers
      return DUMMY_CUSTOMERS[Math.floor(rng() * 15)];
    }
    if (r < 0.7) {
      // Mid 35 regular buyers
      return DUMMY_CUSTOMERS[15 + Math.floor(rng() * 35)];
    }
    // Remaining 50 occasional buyers
    return DUMMY_CUSTOMERS[50 + Math.floor(rng() * 50)];
  };

  const now = new Date();
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    9,
    0,
    0,
    0
  ).getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const logs: Transaction[] = [];
  const outTotals = new Map<string, number>();
  const inTotals = new Map<string, number>();

  // 365 days × 10 customer purchases per day = 3,650 OUT transactions
  for (let dayOffset = 364; dayOffset >= 0; dayOffset--) {
    const dayStart = todayMidnight - dayOffset * DAY_MS;
    const dateObj = new Date(dayStart);
    const month = dateObj.getMonth(); // 0-11

    // Mild festive season demand multiplier (Oct-Nov & Mar-Apr higher)
    const seasonalBoost =
      month === 9 || month === 10 ? 1.35 : month === 2 || month === 3 ? 1.2 : 1.0;

    // Pick 10 distinct customers for this day
    const usedToday = new Set<string>();
    for (let purchaseIdx = 0; purchaseIdx < 10; purchaseIdx++) {
      let customer = pickWeightedCustomer();
      let guard = 0;
      while (usedToday.has(customer) && guard < 12) {
        customer = DUMMY_CUSTOMERS[Math.floor(rng() * DUMMY_CUSTOMERS.length)];
        guard++;
      }
      usedToday.add(customer);

      const prod = pickWeightedCatalog();

      // Realistic quantities: KGS in 500g packet multiples (0.5 to 6.5 kg), PAC/PCS in 1 to 15
      let qty: number;
      if (prod.unit === 'KGS') {
        const packets = Math.max(1, Math.round((1 + rng() * 10) * seasonalBoost));
        qty = roundQty(packets * 0.5);
      } else {
        qty = Math.max(1, Math.round((1 + rng() * 12) * seasonalBoost));
      }

      // Spread timestamps across business hours (9:30 AM - 7:30 PM)
      const minuteOffset = Math.floor(30 + purchaseIdx * 58 + rng() * 25);
      const ts = dayStart + minuteOffset * 60 * 1000;

      const staff = STAFF_NAMES[Math.floor(rng() * STAFF_NAMES.length)];

      logs.push({
        id: `demo-out-${dayOffset}-${purchaseIdx}`,
        type: 'OUT',
        barcode: prod.barcode,
        name: prod.name,
        size: prod.size,
        color: prod.color,
        qty,
        unit: prod.unit,
        price: prod.price,
        totalAmount: roundQty(qty * prod.price),
        source: 'MANUAL',
        doneBy: staff,
        customerName: customer,
        timestamp: ts,
      });

      const key = prod.barcode.toLowerCase();
      outTotals.set(key, roundQty((outTotals.get(key) || 0) + qty));
    }

    // Add realistic weekly restock IN entries (every 7 days) so IN vs OUT trends are rich too
    if (dayOffset % 7 === 0) {
      const restockCount = Math.min(4, catalog.length);
      for (let rIdx = 0; rIdx < restockCount; rIdx++) {
        const prod = catalog[(dayOffset + rIdx * 3) % catalog.length];
        const qty =
          prod.unit === 'KGS'
            ? roundQty(Math.round(15 + rng() * 35) * 0.5)
            : Math.round(20 + rng() * 40);
        const ts = dayStart + (10 + rIdx * 15) * 60 * 1000;
        logs.push({
          id: `demo-in-${dayOffset}-${rIdx}`,
          type: 'IN',
          barcode: prod.barcode,
          name: prod.name,
          size: prod.size,
          color: prod.color,
          qty,
          unit: prod.unit,
          source: 'MANUAL',
          doneBy: 'Admin',
          timestamp: ts,
        });
        const key = prod.barcode.toLowerCase();
        inTotals.set(key, roundQty((inTotals.get(key) || 0) + qty));
      }
    }
  }

  // Newest logs first
  logs.sort((a, b) => b.timestamp - a.timestamp);

  // Build simulated item summary matching the 1-year OUT/IN volumes
  const items: StockItem[] = catalog.map(prod => {
    const key = prod.barcode.toLowerCase();
    const totalOut = outTotals.get(key) || 0;
    const baseRemaining =
      liveItems.find(i => i.barcode.toLowerCase() === key)?.stock ??
      Math.round(25 + rng() * 80);
    const totalIn = roundQty(Math.max(inTotals.get(key) || 0, totalOut + baseRemaining));
    return {
      barcode: prod.barcode,
      name: prod.name,
      size: prod.size,
      color: prod.color,
      price: prod.price,
      totalIn,
      totalOut,
      stock: roundQty(Math.max(0, totalIn - totalOut)),
      unit: prod.unit,
      updatedBy: 'Admin',
      updatedAt: now.getTime(),
    };
  });

  return {
    items,
    logs,
    customers: DUMMY_CUSTOMERS,
  };
}
