// Kumar Enterprises Billing — domain types
// Schema mirrors the upstream Node app's data/ JSON files so a folder export
// is interchangeable with the desktop build.

export type InvoiceType =
  | "tax_invoice"
  | "proforma"
  | "bill_of_supply"
  | "credit_note"
  | "delivery_challan"
  | "non_gst_cash_memo";

export const INVOICE_TYPES: { value: InvoiceType; label: string; short: string }[] = [
  { value: "tax_invoice", label: "Tax Invoice", short: "TI" },
  { value: "proforma", label: "Proforma Invoice", short: "PI" },
  { value: "bill_of_supply", label: "Bill of Supply", short: "BOS" },
  { value: "credit_note", label: "Credit Note", short: "CN" },
  { value: "delivery_challan", label: "Delivery Challan", short: "DC" },
  { value: "non_gst_cash_memo", label: "Non-GST Cash Memo", short: "CM" },
];

export type TaxType = "intra" | "inter" | "exempt" | "zero";
// intra  -> CGST + SGST/UTGST
// inter  -> IGST
// exempt -> no tax (for bill of supply / non-gst)
// zero   -> 0% GST (export / notified)

export interface LineItem {
  id: string;
  productId?: string;
  description: string;
  hsn: string;          // HSN/SAC code
  unit: string;         // e.g. BAG, MT, KG, CFT, BRASS
  quantity: number;
  rate: number;         // per unit, exclusive of tax
  discountPct: number;  // % discount on this line
  gstRate: number;      // 0, 5, 12, 18, 28 (or 0 for non-gst)
  // computed at save time:
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface Invoice {
  id: string;
  number: string;          // INV-2025-0001
  type: InvoiceType;
  status: "draft" | "issued" | "paid" | "partial" | "cancelled";
  clientId: string;
  clientSnapshot: ClientSnapshot;
  issueDate: string;       // ISO date
  dueDate?: string;
  reference?: string;      // PO / challan ref
  placeOfSupply: string;   // state code
  reverseCharge: boolean;
  items: LineItem[];
  globalDiscountPct: number;
  roundOff: number;
  // totals
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
  paidAmount: number;
  balance: number;
  currency: string;        // INR, USD...
  notes?: string;
  terms?: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ClientSnapshot {
  name: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: string;
  state?: string;
  stateCode?: string;
}

export interface Client {
  id: string;
  name: string;
  businessName?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;       // 01..37
  pan?: string;
  openingBalance: number;   // +ve = they owe you
  creditLimit?: number;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  hsn: string;
  unit: string;             // BAG, MT, KG, CFT, BRASS, NOS
  category?: string;        // Cement, Sand, Gravel, Bricks, Steel...
  gstRate: number;          // 0, 5, 12, 18, 28
  salePrice: number;
  purchasePrice?: number;
  stock: number;
  lowStockThreshold: number;
  isGstExempt?: boolean;    // for gitti/balu (gravel/sand) cash sales
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Payment {
  id: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  mode: "cash" | "upi" | "cheque" | "bank" | "card" | "other";
  reference?: string;       // UTR / cheque no
  date: string;
  notes?: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Expense {
  id: string;
  category: string;         // Rent, Freight, Salary, Fuel...
  description: string;
  amount: number;
  mode: "cash" | "upi" | "cheque" | "bank" | "card";
  date: string;
  notes?: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface BusinessProfile {
  name: string;             // Kumar Enterprises
  legalName?: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;       // business's own state code
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  branch?: string;
  upiId?: string;
  logoDataUrl?: string;     // base64 of wide logo
  signatureDataUrl?: string;
}

export interface InvoicePrefs {
  prefix: string;                  // INV
  numberPadding: number;           // 4 -> 0001
  resetYearly: boolean;
  defaultTaxType: TaxType;
  defaultCurrency: string;
  defaultTerms: string;
  defaultNotes: string;
  enableUpiQr: boolean;
  enableRoundOff: boolean;
  printStyle: "classic" | "modern" | "compact";
  accentColor: string;             // brand gold
}

export interface AppSettings {
  schemaVersion: number;
  business: BusinessProfile;
  invoice: InvoicePrefs;
  theme: "light" | "dark";
  preset: string;                  // one of 9 presets
  language: string;
  region: string;
  lowStockAlerts: boolean;
  autoBackup: boolean;
  backupInterval: number;          // changes between auto-exports
  storageMode: "folder" | "opfs" | "manual";
  folderName?: string;             // chosen directory name
  completedSetup: boolean;
  trashEnabled: boolean;
  trashRetentionDays: number;
  updatedAt: string;
}

export interface BackupBundle {
  schemaVersion: number;
  exportedAt: string;
  app: "Kumar Enterprises Billing";
  business: BusinessProfile;
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  payments: Payment[];
  expenses: Expense[];
  settings: AppSettings;
}

export const INDIAN_STATES: { code: string; name: string; isUT: boolean }[] = [
  { code: "01", name: "Jammu & Kashmir", isUT: true },
  { code: "02", name: "Himachal Pradesh", isUT: false },
  { code: "03", name: "Punjab", isUT: false },
  { code: "04", name: "Chandigarh", isUT: true },
  { code: "05", name: "Uttarakhand", isUT: false },
  { code: "06", name: "Haryana", isUT: false },
  { code: "07", name: "Delhi", isUT: true },
  { code: "08", name: "Rajasthan", isUT: false },
  { code: "09", name: "Uttar Pradesh", isUT: false },
  { code: "10", name: "Bihar", isUT: false },
  { code: "11", name: "Sikkim", isUT: false },
  { code: "12", name: "Arunachal Pradesh", isUT: false },
  { code: "13", name: "Nagaland", isUT: false },
  { code: "14", name: "Manipur", isUT: false },
  { code: "15", name: "Mizoram", isUT: false },
  { code: "16", name: "Tripura", isUT: false },
  { code: "17", name: "Meghalaya", isUT: false },
  { code: "18", name: "Assam", isUT: false },
  { code: "19", name: "West Bengal", isUT: false },
  { code: "20", name: "Jharkhand", isUT: false },
  { code: "21", name: "Odisha", isUT: false },
  { code: "22", name: "Chhattisgarh", isUT: false },
  { code: "23", name: "Madhya Pradesh", isUT: false },
  { code: "24", name: "Gujarat", isUT: false },
  { code: "25", name: "Daman & Diu", isUT: true },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu", isUT: true },
  { code: "27", name: "Maharashtra", isUT: false },
  { code: "29", name: "Karnataka", isUT: false },
  { code: "30", name: "Goa", isUT: false },
  { code: "31", name: "Lakshadweep", isUT: true },
  { code: "32", name: "Kerala", isUT: false },
  { code: "33", name: "Tamil Nadu", isUT: false },
  { code: "34", name: "Puducherry", isUT: true },
  { code: "35", name: "Andaman & Nicobar Islands", isUT: true },
  { code: "36", name: "Telangana", isUT: false },
  { code: "37", name: "Andhra Pradesh", isUT: false },
  { code: "38", name: "Ladakh", isUT: true },
  { code: "97", name: "Other Territory", isUT: true },
];

export const UNITS = ["BAG", "MT", "KG", "GM", "CFT", "CUM", "BRASS", "NOS", "LTR", "MTR", "SET", "BOX", "ROLL", "SQFT", "SQM"];
