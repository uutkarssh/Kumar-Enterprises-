// Default settings + seed data for first run
import type { AppSettings, Client, Product } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 1,
  business: {
    name: "Kumar Enterprises",
    legalName: "Kumar Enterprises",
    gstin: "",
    pan: "",
    phone: "",
    email: "",
    address: "Subhash Nagar, Sudhawai, Jangiganj, Bhadohi",
    city: "Bhadohi",
    state: "Uttar Pradesh",
    stateCode: "09",
    bankName: "",
    accountNo: "",
    ifsc: "",
    branch: "",
    upiId: "",
    logoDataUrl: "/icons/logo-wide.png",
  },
  invoice: {
    prefix: "INV",
    numberPadding: 4,
    resetYearly: true,
    defaultTaxType: "intra",
    defaultCurrency: "INR",
    defaultTerms:
      "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if bill is not paid within due date.\n3. Subject to local jurisdiction.",
    defaultNotes: "Thank you for your business.",
    enableUpiQr: true,
    enableRoundOff: true,
    printStyle: "modern",
    accentColor: "#f0a800",
  },
  theme: "light",
  preset: "kumar-gold",
  language: "en",
  region: "IN",
  lowStockAlerts: true,
  autoBackup: true,
  backupInterval: 20,
  storageMode: "manual",
  completedSetup: false,
  trashEnabled: true,
  trashRetentionDays: 30,
  updatedAt: new Date().toISOString(),
};

export const DESIGN_PRESETS: { id: string; name: string; primary: string; surface: string; dark: string }[] = [
  { id: "kumar-gold", name: "Kumar Gold", primary: "#f0a800", surface: "#0a0a0a", dark: "#000000" },
  { id: "midnight", name: "Midnight Gold", primary: "#f5b500", surface: "#0f0f1a", dark: "#08081a" },
  { id: "royal", name: "Royal Amber", primary: "#d4940a", surface: "#1c1305", dark: "#0e0a02" },
  { id: "ink", name: "Pure Ink", primary: "#f0a800", surface: "#111111", dark: "#000000" },
  { id: "warm", name: "Warm Bronze", primary: "#c8860a", surface: "#1a1a1a", dark: "#0a0a0a" },
  { id: "honey", name: "Honey", primary: "#ffb627", surface: "#1a1408", dark: "#0d0a04" },
  { id: "brass", name: "Brass", primary: "#b08d57", surface: "#1a1612", dark: "#0a0806" },
  { id: "classic", name: "Classic B&W", primary: "#111111", surface: "#ffffff", dark: "#0a0a0a" },
  { id: "sunset", name: "Sunset Gold", primary: "#ff9500", surface: "#1a0f02", dark: "#0d0701" },
];

export function seedProducts(): Product[] {
  const now = new Date().toISOString();
  const base: Omit<Product, "id" | "createdAt" | "updatedAt">[] = [
    { name: "OPC Cement 53 Grade", sku: "CEM-OPC53", hsn: "2523", unit: "BAG", category: "Cement", gstRate: 28, salePrice: 420, purchasePrice: 380, stock: 240, lowStockThreshold: 50, isGstExempt: false },
    { name: "OPC Cement 43 Grade", sku: "CEM-OPC43", hsn: "2523", unit: "BAG", category: "Cement", gstRate: 28, salePrice: 400, purchasePrice: 360, stock: 180, lowStockThreshold: 50, isGstExempt: false },
    { name: "PPC Cement", sku: "CEM-PPC", hsn: "2523", unit: "BAG", category: "Cement", gstRate: 28, salePrice: 380, purchasePrice: 340, stock: 120, lowStockThreshold: 40, isGstExempt: false },
    { name: "Gitti (Gravel) 20mm", sku: "GTT-20", hsn: "2517", unit: "CFT", category: "Aggregate", gstRate: 5, salePrice: 38, purchasePrice: 28, stock: 850, lowStockThreshold: 200, isGstExempt: true },
    { name: "Gitti (Gravel) 40mm", sku: "GTT-40", hsn: "2517", unit: "CFT", category: "Aggregate", gstRate: 5, salePrice: 36, purchasePrice: 26, stock: 600, lowStockThreshold: 200, isGstExempt: true },
    { name: "Balu (Sand) — River", sku: "SND-RIV", hsn: "2505", unit: "CFT", category: "Sand", gstRate: 5, salePrice: 45, purchasePrice: 32, stock: 500, lowStockThreshold: 150, isGstExempt: true },
    { name: "Balu (Sand) — M-Sand", sku: "SND-MSN", hsn: "2505", unit: "CFT", category: "Sand", gstRate: 5, salePrice: 40, purchasePrice: 28, stock: 700, lowStockThreshold: 150, isGstExempt: true },
    { name: "Red Bricks (Class A)", sku: "BRK-RED-A", hsn: "6901", unit: "NOS", category: "Bricks", gstRate: 5, salePrice: 8, purchasePrice: 5.5, stock: 20000, lowStockThreshold: 5000, isGstExempt: false },
    { name: "Fly Ash Bricks", sku: "BRK-FLY", hsn: "6815", unit: "NOS", category: "Bricks", gstRate: 5, salePrice: 7, purchasePrice: 4.5, stock: 15000, lowStockThreshold: 5000, isGstExempt: false },
    { name: "TMT Steel Bar 12mm", sku: "STL-T12", hsn: "7213", unit: "KG", category: "Steel", gstRate: 18, salePrice: 78, purchasePrice: 72, stock: 2400, lowStockThreshold: 500, isGstExempt: false },
    { name: "TMT Steel Bar 16mm", sku: "STL-T16", hsn: "7213", unit: "KG", category: "Steel", gstRate: 18, salePrice: 79, purchasePrice: 73, stock: 1800, lowStockThreshold: 500, isGstExempt: false },
    { name: "Acc Cement White 1kg", sku: "CEM-WHT", hsn: "2523", unit: "KG", category: "Cement", gstRate: 28, salePrice: 28, purchasePrice: 22, stock: 80, lowStockThreshold: 30, isGstExempt: false },
  ];
  return base.map((p, i) => ({
    ...p,
    id: `seed-prod-${i + 1}`,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));
}

export function seedClients(): Client[] {
  const now = new Date().toISOString();
  const base: Omit<Client, "id" | "createdAt" | "updatedAt" | "deletedAt">[] = [
    { name: "Suresh Kumar", businessName: "Suresh Construction", gstin: "", phone: "9876543210", email: "", address: "Near Bus Stand, Civil Lines", city: "Ranchi", state: "Jharkhand", stateCode: "20", openingBalance: 0, creditLimit: 100000, tags: ["retail", "cash"] },
    { name: "Shree Constructions Pvt Ltd", businessName: "Shree Constructions Pvt Ltd", gstin: "20ABCDE1234F1Z5", phone: "9123456780", email: "accounts@shreecon.in", address: "Industrial Area, Phase II", city: "Jamshedpur", state: "Jharkhand", stateCode: "20", openingBalance: 45000, creditLimit: 500000, pan: "ABCDE1234F", tags: ["b2b"] },
    { name: "Mahavir Builders", businessName: "Mahavir Builders", gstin: "20PQRSX5678K1Z2", phone: "9001122334", email: "mahavir.builder@gmail.com", address: "Main Road, Bistupur", city: "Jamshedpur", state: "Jharkhand", stateCode: "20", openingBalance: 0, creditLimit: 300000, pan: "PQRSX5678K", tags: ["b2b", "contractor"] },
    { name: "Ramesh Hardware", businessName: "Ramesh Hardware Store", gstin: "", phone: "9876501234", address: "Station Road", city: "Ranchi", state: "Jharkhand", stateCode: "20", openingBalance: 12000, tags: ["retail", "cash"] },
    { name: "Walk-in Cash Customer", businessName: "Cash Sale", gstin: "", phone: "", address: "Counter Sale", city: "Ranchi", state: "Jharkhand", stateCode: "20", openingBalance: 0, tags: ["cash", "walk-in"] },
  ];
  return base.map((c, i) => ({
    ...c,
    id: `seed-cli-${i + 1}`,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));
}
