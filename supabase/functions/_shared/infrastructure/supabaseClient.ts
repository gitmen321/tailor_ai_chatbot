import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, requireEnv } from "../env.ts";
import { requirePrivilegedSupabaseKey } from "../serverKey.ts";

let cached: SupabaseClient | null = null;

/** Create the server-side Supabase client once per Edge Function instance. */
export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = requireEnv("SUPABASE_URL");
  const serverKey = requirePrivilegedSupabaseKey(
    env("SUPABASE_SECRET_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY"),
  );

  cached = createClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
