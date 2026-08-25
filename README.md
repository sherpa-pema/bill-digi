# DigiBill — Digital Chit & POS System

A modern, mobile-first Point of Sale (POS) and Digital Chit billing application built with React, TypeScript, Tailwind CSS, and Supabase.

---

## Features

- **⚡ Fast Keypad & Itemized Billing**: Quick number pad entry for simple totals or itemized baskets with quantity controls.
- **☁️ Supabase Cloud-First**: PostgreSQL database as the single source of truth for all shops, inventory items, and generated bills.
- **🔐 Business Authentication**: Supabase Auth integration supporting email and phone registration/login.
- **🧾 Instant Digital Receipts & QR**: Generates shareable digital invoices via WhatsApp, SMS, and QR codes (IRD Nepal lottery compatible).
- **📋 Live History & Search**: Search and view past bills in real-time.
- **📦 Inventory Management**: Add, update, and remove catalog items with live cloud updates.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Icons**: Lucide React
- **Backend / Database**: Supabase (PostgreSQL, Supabase Auth, Row Level Security)
- **Tooling**: Oxlint

---

## Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/sherpa-pema/bill-digi.git
cd bill-digi
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Database Schema
Apply the SQL schema in `supabase/schema.sql` to your Supabase SQL editor to create the `shops`, `items`, and `bills` tables with Row Level Security.

### 4. Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
```

---

## 🚀 Deploy to Vercel

1. **Import the repository** on [Vercel](https://vercel.com/new).
2. Framework Preset: **Vite** (automatically detected via `vercel.json`).
3. Set the following **Environment Variables** in your Vercel Project Settings:
   - `VITE_SUPABASE_URL`: `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `your-supabase-anon-key`
4. Click **Deploy**.

---

## License
MIT
