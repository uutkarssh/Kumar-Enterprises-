// Pairing code flow — links a new device to an existing owner's data.
//
// Flow:
// 1. PC (first device) calls generatePairingCode() → 6-char code, 10-min TTL
// 2. Phone (new device) calls claimPairingCode(code) → returns owner_id
// 3. Phone stores owner_id, pulls all data from Supabase, starts realtime sync
// 4. From now on, both devices sync automatically (no more codes needed)

import { supabase, PAIRING_TABLE } from "./supabase";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
const CODE_LENGTH = 6;
const TTL_MINUTES = 10;

function generateCode(): string {
  let code = "";
  const arr = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(arr);
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[arr[i] % CODE_CHARS.length];
  }
  return code;
}

/** Generate a 6-character pairing code tied to the current owner. */
export async function generatePairingCode(ownerId: string): Promise<{ code: string; expiresAt: string } | { error: string }> {
  if (!supabase) return { error: "Supabase is not configured. Check your environment variables." };

  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString();

  const { error } = await supabase.from(PAIRING_TABLE).insert({
    code,
    owner_id: ownerId,
    expires_at: expiresAt,
  });

  if (error) {
    // If code collision (extremely rare), retry once
    if (error.code === "23505") {
      return generatePairingCode(ownerId);
    }
    return { error: error.message };
  }

  return { code, expiresAt: expiresAt };
}

/** Claim a pairing code — returns the owner_id if valid. */
export async function claimPairingCode(
  code: string
): Promise<{ ownerId: string } | { error: string }> {
  if (!supabase) return { error: "Supabase is not configured." };

  const normalized = code.trim().toUpperCase();

  // Look up the code
  const { data, error } = await supabase
    .from(PAIRING_TABLE)
    .select("owner_id, expires_at, used_at")
    .eq("code", normalized)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Invalid code. Please check and try again." };
  if (data.used_at) return { error: "This code has already been used. Generate a new one." };
  if (new Date(data.expires_at) < new Date()) {
    return { error: "This code has expired. Generate a new one." };
  }

  // Mark as used
  const { error: updateError } = await supabase
    .from(PAIRING_TABLE)
    .update({ used_at: new Date().toISOString() })
    .eq("code", normalized);

  if (updateError) {
    // If someone else claimed it in the same instant, treat as already used
    if (updateError.code === "23505") return { error: "This code has already been used." };
    return { error: updateError.message };
  }

  return { ownerId: data.owner_id };
}

/** Check if Supabase is reachable and the sync tables exist. */
export async function checkPairingHealth(): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase is not configured." };
  try {
    const { error } = await supabase
      .from(PAIRING_TABLE)
      .select("code")
      .limit(1)
      .maybeSingle();
    if (error) {
      if (error.message.includes("relation") || error.message.includes("does not exist")) {
        return {
          ok: false,
          message: "Sync tables not found. Run the SQL schema in your Supabase SQL Editor first (see supabase/schema.sql).",
        };
      }
      if (error.message.includes("Failed to fetch") || error.message.includes("fetch")) {
        return {
          ok: false,
          message: "Cannot reach Supabase. Check your internet connection and that your Supabase project is active (not paused).",
        };
      }
      return { ok: false, message: error.message };
    }
    return { ok: true, message: "Supabase is ready." };
  } catch (e: any) {
    return {
      ok: false,
      message: `Cannot reach Supabase: ${e?.message || "unknown error"}. Make sure your project is active.`,
    };
  }
}
