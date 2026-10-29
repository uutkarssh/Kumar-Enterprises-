// Applies remote Supabase changes to IndexedDB.
// This is called by the realtime subscription in sync.ts.
// The `isApplyingRemote` flag in sync.ts prevents these writes from
// triggering a push back to Supabase (infinite loop prevention).

import { getDb } from "./db";
import { isApplyingRemoteChanges } from "./sync";
import type { Invoice, Client, Product, Payment, Expense, AppSettings } from "./types";

export async function applyRemoteRecord(
  tableName: string,
  data: any,
  deletedAt: string | null
): Promise<void> {
  const db = await getDb();
  switch (tableName) {
    case "invoices":
      await db.put("invoices", { ...data, deletedAt } as Invoice);
      break;
    case "clients":
      await db.put("clients", { ...data, deletedAt } as Client);
      break;
    case "products":
      await db.put("products", { ...data, deletedAt } as Product);
      break;
    case "payments":
      await db.put("payments", { ...data, deletedAt } as Payment);
      break;
    case "expenses":
      await db.put("expenses", { ...data, deletedAt } as Expense);
      break;
    case "settings":
      await db.put("settings", { ...(data as AppSettings) });
      break;
  }
}

export async function applyRemoteDelete(tableName: string, id: string): Promise<void> {
  const db = await getDb();
  // For settings, the id is "app" and we don't delete — just skip
  if (tableName === "settings") return;
  try {
    // Soft-delete: mark as deleted so the UI hides it, but keep for trash bin
    const store = db.transaction(tableName, "readwrite").objectStore(tableName);
    const existing = await store.get(id);
    if (existing) {
      await store.put({ ...existing, deletedAt: new Date().toISOString() });
    }
  } catch {
    // best-effort
  }
}

// Re-export for convenience
export { isApplyingRemoteChanges };
