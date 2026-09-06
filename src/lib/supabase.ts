import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readViteEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string {
  try {
    const env = import.meta.env as ImportMetaEnv | undefined;
    const value = env?.[name];
    return typeof value === "string" ? value.trim() : "";
  } catch {
    /* Vite inlines these at build time; missing keys must not throw. */
    return "";
  }
}

export function getSupabaseConfig() {
  const url = readViteEnv("VITE_SUPABASE_URL");
  const anonKey = readViteEnv("VITE_SUPABASE_ANON_KEY");
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
