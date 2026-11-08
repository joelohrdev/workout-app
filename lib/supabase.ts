"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** True when the Supabase env vars were present at build time. */
export const syncConfigured = !!(url && key);

let client: SupabaseClient | null = null;

/** Browser Supabase client, or null when sync isn't configured. */
export function getSupabase(): SupabaseClient | null {
  if (!syncConfigured || typeof window === "undefined") return null;
  client ??= createClient(url!, key!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
