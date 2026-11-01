export function env(name: string, fallback?: string): string | undefined {
  try {
    const value = Deno.env.get(name);
    if (value != null && value !== "") return value;
  } catch {
    // permission or non-Deno runtime
  }
  return fallback;
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Missing ${name} in environment`);
  return value;
}
