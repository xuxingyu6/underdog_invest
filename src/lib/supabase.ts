import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseConfig() {
  let url = "";
  let anonKey = "";
  try {
    url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
    anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  } catch {
    /* Vite replaces these at build time; missing env must not throw. */
  }
  return { url, anonKey, configured: Boolean(url && anonKey) };
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey, configured } = getSupabaseConfig();
  if (!configured) return null;
  if (!client) {
    try {
      client = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch {
      return null;
    }
  }
  return client;
}
