/**
 * Map hosted and local URLs onto the Express-style API path.
 *   /functions/v1/api/chat  -> /chat
 *   /api/chat               -> /chat
 *   /health                 -> /health
 */
export function normalizeApiPath(pathname: string): string {
  let p = pathname || "/";
  if (p.startsWith("/functions/v1/api")) {
    p = p.slice("/functions/v1/api".length);
  } else if (p.startsWith("/api")) {
    p = p.slice("/api".length);
  }
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}
