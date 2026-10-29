// Kumar Enterprises Billing — client-side data layer
// All records live in IndexedDB so the PWA is standalone on Android.
// A folder-backed export/import flow mirrors this to a user-chosen directory.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  AppSettings,
  BackupBundle,
  Client,
  Expense,
  Invoice,
  Payment,
  Product,
} from "./types";
import { DEFAULT_SETTINGS } from "./defaults";

// Sync hooks — dual-write to Supabase. No-op if sync is inactive.
// Imported lazily to avoid circular deps + to work when Supabase isn't configured.
let _syncPush: ((t: any, r: any) => Promise<void>) | null = null;
let _syncDelete: ((t: any, id: string) => Promise<void>) | null = null;
async function syncPush(t: any, r: any) {
  if (!_syncPush) {
    try {
      const m = await import("./sync");
      _syncPush = m.syncPush;
      _syncDelete = m.syncDelete;
    } catch {
      return;
    }
  }
  return _syncPush?.(t, r);
}
async function syncDelete(t: any, id: string) {
  if (!_syncDelete) {
    try {
      const m = await import("./sync");
      _syncPush = m.syncPush;
      _syncDelete = m.syncDelete;
    } catch {
      return;
    }
  }
  return _syncDelete?.(t, id);
}

const DB_NAME = "ke-billing";
const DB_VERSION = 1;

interface KeDb extends DBSchema {
  invoices: { key: string; value: Invoice; indexes: { "by-number": string; "by-client": string } };
  clients: { key: string; value: Client; indexes: { "by-name": string } };
  products: { key: string; value: Product; indexes: { "by-sku": string; "by-name": string } };
  payments: { key: string; value: Payment; indexes: { "by-invoice": string; "by-client": string } };
  expenses: { key: string; value: Expense; indexes: { "by-date": string } };
  settings: { key: string; value: AppSettings };
  meta: { key: string; value: any };
}

let dbPromise: Promise<IDBPDatabase<KeDb>> | null = null;

export function getDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  if (!dbPromise) {
    dbPromise = openDB<KeDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("invoices")) {
          const s = db.createObjectStore("invoices", { keyPath: "id" });
          s.createIndex("by-number", "number");
          s.createIndex("by-client", "clientId");
        }
        if (!db.objectStoreNames.contains("clients")) {
          const s = db.createObjectStore("clients", { keyPath: "id" });
          s.createIndex("by-name", "name");
        }
        if (!db.objectStoreNames.contains("products")) {
          const s = db.createObjectStore("products", { keyPath: "id" });
          s.createIndex("by-sku", "sku");
          s.createIndex("by-name", "name");
        }
        if (!db.objectStoreNames.contains("payments")) {
          const s = db.createObjectStore("payments", { keyPath: "id" });
          s.createIndex("by-invoice", "invoiceId");
          s.createIndex("by-client", "clientId");
        }
        if (!db.objectStoreNames.contains("expenses")) {
          const s = db.createObjectStore("expenses", { keyPath: "id" });
          s.createIndex("by-date", "date");
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "schemaVersion" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
      },
    });
  }
  return dbPromise;
}

// ---------- Settings ----------
export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const cur = await db.get("settings", 1);
  if (cur) return cur;
  await db.put("settings", DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function saveSettings(s: AppSettings): Promise<void> {
  const db = await getDb();
  const updated = { ...s, updatedAt: new Date().toISOString() };
  await db.put("settings", updated);
  // Settings use a fixed id ("app" in sync_records) — the sync layer wraps it
  void syncPush("settings", { ...updated, id: "app" } as any);
}

// ---------- Invoices ----------
export async function listInvoices(includeDeleted = false): Promise<Invoice[]> {
  const db = await getDb();
  const all = await db.getAll("invoices");
  return all
    .filter((i) => includeDeleted || !i.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getInvoice(id: string): Promise<Invoice | undefined> {
  const db = await getDb();
  return db.get("invoices", id);
}

export async function putInvoice(inv: Invoice): Promise<void> {
  const db = await getDb();
  await db.put("invoices", inv);
  void syncPush("invoices", inv);
}

export async function softDeleteInvoice(id: string): Promise<void> {
  const db = await getDb();
  const inv = await db.get("invoices", id);
  if (inv) {
    const updated = { ...inv, deletedAt: new Date().toISOString(), status: "cancelled" as const };
    await db.put("invoices", updated);
    void syncPush("invoices", updated);
  }
}

export async function restoreInvoice(id: string): Promise<void> {
  const db = await getDb();
  const inv = await db.get("invoices", id);
  if (inv) {
    const updated = { ...inv, deletedAt: null };
    await db.put("invoices", updated);
    void syncPush("invoices", updated);
  }
}

export async function purgeInvoice(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("invoices", id);
  void syncDelete("invoices", id);
}

// ---------- Clients ----------
export async function listClients(includeDeleted = false): Promise<Client[]> {
  const db = await getDb();
  const all = await db.getAll("clients");
  return all
    .filter((c) => includeDeleted || !c.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getClient(id: string): Promise<Client | undefined> {
  const db = await getDb();
  return db.get("clients", id);
}

export async function putClient(c: Client): Promise<void> {
  const db = await getDb();
  await db.put("clients", c);
  void syncPush("clients", c);
}

export async function softDeleteClient(id: string): Promise<void> {
  const db = await getDb();
  const c = await db.get("clients", id);
  if (c) {
    const updated = { ...c, deletedAt: new Date().toISOString() };
    await db.put("clients", updated);
    void syncPush("clients", updated);
  }
}

// ---------- Products ----------
export async function listProducts(includeDeleted = false): Promise<Product[]> {
  const db = await getDb();
  const all = await db.getAll("products");
  return all
    .filter((p) => includeDeleted || !p.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const db = await getDb();
  return db.get("products", id);
}

export async function putProduct(p: Product): Promise<void> {
  const db = await getDb();
  await db.put("products", p);
  void syncPush("products", p);
}

export async function softDeleteProduct(id: string): Promise<void> {
  const db = await getDb();
  const p = await db.get("products", id);
  if (p) {
    const updated = { ...p, deletedAt: new Date().toISOString() };
    await db.put("products", updated);
    void syncPush("products", updated);
  }
}

export async function adjustStock(id: string, delta: number): Promise<void> {
  const db = await getDb();
  const p = await db.get("products", id);
  if (p) {
    const updated = { ...p, stock: p.stock + delta, updatedAt: new Date().toISOString() };
    await db.put("products", updated);
    void syncPush("products", updated);
  }
}

// ---------- Payments ----------
export async function listPayments(includeDeleted = false): Promise<Payment[]> {
  const db = await getDb();
  const all = await db.getAll("payments");
  return all
    .filter((p) => includeDeleted || !p.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function listPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
  const db = await getDb();
  const idx = db.transaction("payments").store.index("by-invoice");
  const all = await idx.getAll(invoiceId);
  return all.filter((p) => !p.deletedAt).sort((a, b) => a.date.localeCompare(b.date));
}

export async function listPaymentsForClient(clientId: string): Promise<Payment[]> {
  const db = await getDb();
  const idx = db.transaction("payments").store.index("by-client");
  const all = await idx.getAll(clientId);
  return all.filter((p) => !p.deletedAt).sort((a, b) => a.date.localeCompare(b.date));
}

export async function putPayment(p: Payment): Promise<void> {
  const db = await getDb();
  await db.put("payments", p);
  void syncPush("payments", p);
}

export async function softDeletePayment(id: string): Promise<void> {
  const db = await getDb();
  const p = await db.get("payments", id);
  if (p) {
    const updated = { ...p, deletedAt: new Date().toISOString() };
    await db.put("payments", updated);
    void syncPush("payments", updated);
  }
}

// ---------- Expenses ----------
export async function listExpenses(includeDeleted = false): Promise<Expense[]> {
  const db = await getDb();
  const all = await db.getAll("expenses");
  return all
    .filter((e) => includeDeleted || !e.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function putExpense(e: Expense): Promise<void> {
  const db = await getDb();
  await db.put("expenses", e);
  void syncPush("expenses", e);
}

export async function softDeleteExpense(id: string): Promise<void> {
  const db = await getDb();
  const e = await db.get("expenses", id);
  if (e) {
    const updated = { ...e, deletedAt: new Date().toISOString() };
    await db.put("expenses", updated);
    void syncPush("expenses", updated);
  }
}

// ---------- Bulk backup / restore ----------
export async function exportBundle(): Promise<BackupBundle> {
  const [invoices, clients, products, payments, expenses, settings] = await Promise.all([
    listInvoices(true),
    listClients(true),
    listProducts(true),
    listPayments(true),
    listExpenses(true),
    getSettings(),
  ]);
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: "Kumar Enterprises Billing",
    business: settings.business,
    invoices,
    clients,
    products,
    payments,
    expenses,
    settings,
  };
}

export async function importBundle(bundle: BackupBundle, mode: "merge" | "replace" = "merge"): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ["invoices", "clients", "products", "payments", "expenses", "settings"],
    "readwrite"
  );
  if (mode === "replace") {
    await Promise.all([
      tx.objectStore("invoices").clear(),
      tx.objectStore("clients").clear(),
      tx.objectStore("products").clear(),
      tx.objectStore("payments").clear(),
      tx.objectStore("expenses").clear(),
    ]);
  }
  await Promise.all(bundle.invoices.map((i) => tx.objectStore("invoices").put(i)));
  await Promise.all(bundle.clients.map((c) => tx.objectStore("clients").put(c)));
  await Promise.all(bundle.products.map((p) => tx.objectStore("products").put(p)));
  await Promise.all(bundle.payments.map((p) => tx.objectStore("payments").put(p)));
  await Promise.all(bundle.expenses.map((e) => tx.objectStore("expenses").put(e)));
  if (bundle.settings) await tx.objectStore("settings").put(bundle.settings);
  await tx.done;
}

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ["invoices", "clients", "products", "payments", "expenses"],
    "readwrite"
  );
  await Promise.all([
    tx.objectStore("invoices").clear(),
    tx.objectStore("clients").clear(),
    tx.objectStore("products").clear(),
    tx.objectStore("payments").clear(),
    tx.objectStore("expenses").clear(),
  ]);
  await tx.done;
}
