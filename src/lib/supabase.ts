// Supabase client — uses the public anon key (safe for client-side).
// The service role key is NEVER used in the app — it was only for one-time
// schema setup and should be rotated in the Supabase dashboard.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

// Table names
export const SYNC_TABLE = "sync_records";
export const PAIRING_TABLE = "pairing_codes";

// Data table names (stored in the `table_name` column of sync_records)
export type TableName =
  | "invoices"
  | "clients"
  | "products"
  | "payments"
  | "expenses"
  | "settings";
