import { AppError } from "./errors.ts";

function jwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).role ?? null;
  } catch {
    return null;
  }
}

/** Accept only a Supabase server key that can access service-role-only data. */
export function requirePrivilegedSupabaseKey(key?: string): string {
  if (!key) {
    throw new AppError(
      503,
      "server_supabase_key_missing",
      "The API is missing its Supabase server key. Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY on the API server.",
    );
  }

  if (key.startsWith("sb_secret_") || jwtRole(key) === "service_role") {
    return key;
  }

  throw new AppError(
    503,
    "server_supabase_key_invalid",
    "The API is using a publishable/anon Supabase key for server access. Set SUPABASE_SECRET_KEY (sb_secret_…) or the legacy service_role key in server/.env. Never use a publishable/anon key as the server key.",
  );
}
