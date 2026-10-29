// Sync layer — keeps IndexedDB and Supabase in sync.
//
// Architecture:
// - IndexedDB stays the local source of truth (offline-first).
// - Every write to IndexedDB also pushes to Supabase (dual-write).
// - Supabase Realtime pushes remote changes back to IndexedDB.
// - A `isApplyingRemote` flag prevents infinite loops (remote → local → remote).
// - If Supabase is unreachable, sync silently no-ops (app stays fully functional
//   via IndexedDB alone).

import { supabase, SYNC_TABLE, type TableName } from "./supabase";
import type { Invoice, Client, Product, Payment, Expense, AppSettings } from "./types";

type AnyRecord = Invoice | Client | Product | Payment | Expense | AppSettings;

let isApplyingRemote = false;
let activeOwnerId: string | null = null;
let realtimeChannel: any = null;
let onRemoteChange: (() => void) | null = null;

export function isSyncActive(): boolean {
  return activeOwnerId !== null && supabase !== null;
}

export function setSyncOwner(ownerId: string | null, onChange?: () => void): void {
  // Unsubscribe previous
  if (realtimeChannel && supabase) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  activeOwnerId = ownerId;
  onRemoteChange = onChange || null;
  if (ownerId && supabase) {
    initRealtime(ownerId);
  }
}

export function isApplyingRemoteChanges(): boolean {
  return isApplyingRemote;
}

/** Push a record to Supabase (fire-and-forget, non-blocking). */
export async function syncPush(tableName: TableName, record: AnyRecord): Promise<void> {
  if (!activeOwnerId || !supabase || isApplyingRemote) return;
  try {
    const payload = {
      owner_id: activeOwnerId,
      table_name: tableName,
      id: record.id,
      data: record,
      updated_at: new Date().toISOString(),
      deleted_at: (record as any).deletedAt || null,
    };
    const { error } = await supabase.from(SYNC_TABLE).upsert(payload, {
      onConflict: "owner_id,table_name,id",
    });
    if (error) console.warn("[sync] push error:", error.message);
  } catch (e: any) {
    console.warn("[sync] push failed:", e?.message);
  }
}

/** Mark a record as deleted in Supabase (soft delete — keeps the row for sync). */
export async function syncDelete(tableName: TableName, id: string): Promise<void> {
  if (!activeOwnerId || !supabase || isApplyingRemote) return;
  try {
    const { error } = await supabase
      .from(SYNC_TABLE)
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("owner_id", activeOwnerId)
      .eq("table_name", tableName)
      .eq("id", id);
    if (error) console.warn("[sync] delete error:", error.message);
  } catch (e: any) {
    console.warn("[sync] delete failed:", e?.message);
  }
}

/** Pull ALL records from Supabase for the current owner (initial sync on a new device). */
export async function pullAll(): Promise<{ [K in TableName]?: AnyRecord[] }> {
  if (!activeOwnerId || !supabase) return {};
  try {
    const { data, error } = await supabase
      .from(SYNC_TABLE)
      .select("table_name, data, deleted_at")
      .eq("owner_id", activeOwnerId)
      .order("updated_at", { ascending: true });
    if (error) {
      console.warn("[sync] pullAll error:", error.message);
      return {};
    }
    const result: any = {};
    for (const row of data || []) {
      if (!result[row.table_name]) result[row.table_name] = [];
      result[row.table_name].push(row.data);
    }
    return result;
  } catch (e: any) {
    console.warn("[sync] pullAll failed:", e?.message);
    return {};
  }
}

/** Push ALL local data to Supabase (initial upload on first sync enable). */
export async function pushAll(data: {
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  payments: Payment[];
  expenses: Expense[];
  settings?: AppSettings;
}): Promise<{ pushed: number; errors: number }> {
  if (!activeOwnerId || !supabase) return { pushed: 0, errors: 0 };
  let pushed = 0;
  let errors = 0;
  const now = new Date().toISOString();
  const rows: any[] = [];
  for (const inv of data.invoices) {
    rows.push({
      owner_id: activeOwnerId, table_name: "invoices" as TableName,
      id: inv.id, data: inv, updated_at: inv.updatedAt || now, deleted_at: inv.deletedAt || null,
    });
  }
  for (const c of data.clients) {
    rows.push({
      owner_id: activeOwnerId, table_name: "clients" as TableName,
      id: c.id, data: c, updated_at: c.updatedAt || now, deleted_at: c.deletedAt || null,
    });
  }
  for (const p of data.products) {
    rows.push({
      owner_id: activeOwnerId, table_name: "products" as TableName,
      id: p.id, data: p, updated_at: p.updatedAt || now, deleted_at: p.deletedAt || null,
    });
  }
  for (const p of data.payments) {
    rows.push({
      owner_id: activeOwnerId, table_name: "payments" as TableName,
      id: p.id, data: p, updated_at: p.createdAt || now, deleted_at: p.deletedAt || null,
    });
  }
  for (const e of data.expenses) {
    rows.push({
      owner_id: activeOwnerId, table_name: "expenses" as TableName,
      id: e.id, data: e, updated_at: e.createdAt || now, deleted_at: e.deletedAt || null,
    });
  }
  if (data.settings) {
    rows.push({
      owner_id: activeOwnerId, table_name: "settings" as TableName,
      id: "app", data: data.settings, updated_at: now, deleted_at: null,
    });
  }
  // Batch upsert (Supabase handles arrays)
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(SYNC_TABLE).upsert(batch, {
      onConflict: "owner_id,table_name,id",
    });
    if (error) {
      console.warn("[sync] pushAll batch error:", error.message);
      errors += batch.length;
    } else {
      pushed += batch.length;
    }
  }
  return { pushed, errors };
}

/** Apply a remote change to IndexedDB (called by realtime subscription). */
async function applyRemoteChange(row: any): Promise<void> {
  const { applyRemoteRecord } = await import("./db-remote");
  await applyRemoteRecord(row.table_name, row.data, row.deleted_at);
}

/** Initialize realtime subscription for the current owner. */
function initRealtime(ownerId: string): void {
  if (!supabase) return;
  realtimeChannel = supabase
    .channel(`sync_${ownerId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: SYNC_TABLE,
        filter: `owner_id=eq.${ownerId}`,
      },
      async (payload: any) => {
        isApplyingRemote = true;
        try {
          await applyRemoteChange(payload.new);
        } finally {
          isApplyingRemote = false;
          onRemoteChange?.();
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: SYNC_TABLE,
        filter: `owner_id=eq.${ownerId}`,
      },
      async (payload: any) => {
        isApplyingRemote = true;
        try {
          await applyRemoteChange(payload.new);
        } finally {
          isApplyingRemote = false;
          onRemoteChange?.();
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: SYNC_TABLE,
        filter: `owner_id=eq.${ownerId}`,
      },
      async (payload: any) => {
        // Row was hard-deleted on another device — soft-delete locally
        isApplyingRemote = true;
        try {
          const { applyRemoteDelete } = await import("./db-remote");
          await applyRemoteDelete(payload.old.table_name, payload.old.id);
        } finally {
          isApplyingRemote = false;
          onRemoteChange?.();
        }
      }
    )
    .subscribe();
}

/** Check if Supabase is reachable (quick health check). */
export async function checkSupabaseHealth(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from(SYNC_TABLE)
      .select("id")
      .limit(1)
      .maybeSingle();
    // If no error (even if no rows), Supabase is reachable + table exists
    return !error;
  } catch {
    return false;
  }
}

/** Disconnect realtime (e.g., when unpairing). */
export function disconnectSync(): void {
  if (realtimeChannel && supabase) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  activeOwnerId = null;
}
