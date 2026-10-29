"use client";
import { create } from "zustand";
import type { AppSettings, Client, Invoice, Payment, Product, Expense } from "./types";
import { DEFAULT_SETTINGS } from "./defaults";

export type ViewKey =
  | "dashboard"
  | "invoices"
  | "invoice-builder"
  | "invoice-preview"
  | "clients"
  | "client-ledger"
  | "products"
  | "reports"
  | "settings"
  | "backup"
  | "trash";

interface AppState {
  view: ViewKey;
  selectedInvoiceId: string | null;
  selectedClientId: string | null;
  editingInvoice: Invoice | null;
  commandOpen: boolean;
  settings: AppSettings | null;
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  payments: Payment[];
  expenses: Expense[];
  loaded: boolean;
  installPromptEvent: any | null;
  setView: (v: ViewKey) => void;
  openInvoice: (id: string) => void;
  editInvoice: (inv: Invoice | null) => void;
  openClient: (id: string) => void;
  setCommandOpen: (b: boolean) => void;
  setSettings: (s: AppSettings) => void;
  setData: (d: {
    invoices?: Invoice[];
    clients?: Client[];
    products?: Product[];
    payments?: Payment[];
    expenses?: Expense[];
    settings?: AppSettings;
  }) => void;
  setInstallPrompt: (e: any | null) => void;
  reload: () => Promise<void>;
}

let refreshFn: (() => Promise<void>) | null = null;
export function registerRefresh(fn: () => Promise<void>) {
  refreshFn = fn;
}

export const useApp = create<AppState>((set, get) => ({
  view: "dashboard",
  selectedInvoiceId: null,
  selectedClientId: null,
  editingInvoice: null,
  commandOpen: false,
  settings: null,
  invoices: [],
  clients: [],
  products: [],
  payments: [],
  expenses: [],
  loaded: false,
  installPromptEvent: null,
  setView: (v) => set({ view: v }),
  openInvoice: (id) => set({ selectedInvoiceId: id, view: "invoice-preview" }),
  editInvoice: (inv) => set({ editingInvoice: inv, view: inv ? "invoice-builder" : get().view }),
  openClient: (id) => set({ selectedClientId: id, view: "client-ledger" }),
  setCommandOpen: (b) => set({ commandOpen: b }),
  setSettings: (s) => set({ settings: s }),
  setData: (d) => set({ ...d, loaded: true }),
  setInstallPrompt: (e) => set({ installPromptEvent: e }),
  reload: async () => {
    if (refreshFn) await refreshFn();
  },
}));

export function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}
