import { createClient } from "@supabase/supabase-js";
import { createTimedFetch } from "../services/auth/timedFetch.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || "https://missing-project.supabase.co",
  supabaseAnonKey || "missing-anon-key",
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    global: { fetch: createTimedFetch((input, init) => fetch(input, init)) },
  },
);
