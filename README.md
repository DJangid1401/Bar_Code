# 📦 QR & Barcode Inventory Management System

A modern, fast, and responsive QR & Barcode Inventory Management web application built with **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Zustand**.

---

## 🚀 Features

- **📷 QR / Barcode Scanner**: Scan barcodes and QR codes directly via device camera using `html5-qrcode`.
- **⌨️ Manual Entry Support**: Seamless manual barcode entry with validation and auto-fill for existing items.
- **📥 Stock IN (Inward)**: Add new items to inventory or increment existing stock.
- **📤 Stock OUT (Dispatch / Sale)**: Reduce stock with strict validation preventing negative inventory or unlisted item dispatch.
- **📊 Real-time Dashboard**: Live overview of total stock, unique items, daily IN/OUT counts, live stock feed, and timestamped transaction logs.
- **📋 Full Stock List**: Searchable inventory table displaying product name, barcode/SKU, and real-time stock levels.
- **💾 Persistent State**: All inventory items and transaction logs persist in `localStorage` via Zustand persist middleware.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Lucide React (Icons)
- **State Management**: Zustand (with localStorage persistence)
- **Routing**: React Router DOM (HashRouter)
- **Barcode & QR Scanning**: `html5-qrcode`

---

## 📂 Project Structure

```
scanning/
├── src/
│   ├── components/
│   │   └── QRScanner.tsx      # QR & Barcode camera scanner modal
│   ├── pages/
│   │   ├── Dashboard.tsx      # KPI stats, live stock list & recent activity
│   │   ├── In.tsx             # Stock IN inward processing form & scanner
│   │   ├── Out.tsx            # Stock OUT dispatch processing form & scanner
│   │   └── Stock.tsx          # Complete inventory list with search filter
│   ├── App.tsx                # App layout & routing
│   ├── main.tsx               # Entry point
│   ├── store.tsx              # Zustand state & inventory transactions
│   └── index.css              # Tailwind CSS styles
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## ⚡ Getting Started

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v18 or higher) installed.

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/DJangid1401/Bar_Code.git

# Navigate to the project directory
cd Bar_Code

# Install dependencies
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173/`.

### 4. Build for Production
```bash
npm run build
```
The production bundle will be generated in the `dist/` directory.

---

## 📝 Author
- **DJangid1401** - [GitHub Profile](https://github.com/DJangid1401)
