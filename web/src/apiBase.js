function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function normalizeConfiguredOrigin(configured) {
  try {
    const url = new URL(configured);
    if (isLocalHostname(url.hostname)) return "";
    if (url.hostname.endsWith(".railway.app")) {
      url.port = "";
    }
    const path = url.pathname.replace(/\/$/, "");
    if (url.hostname.endsWith(".supabase.co") && path.startsWith("/functions/v1")) {
      return `${url.origin}${path}`;
    }
    return url.origin;
  } catch {
    return configured.replace(/\/$/, "");
  }
}

/**
 * Pick the API origin the browser should call.
 * Hosted web (Netlify) and local Vite default to same-origin "" so /api is
 * proxied and CORS is never required. A direct API URL is only used when
 * explicitly set.
 */
export function resolveApiBase(configured, hostname = "") {
  const value = String(configured ?? "").trim();
  const onLocalDev = isLocalHostname(hostname);

  if (onLocalDev) {
    return value ? normalizeConfiguredOrigin(value) : "";
  }

  if (!value) return "";
  return normalizeConfiguredOrigin(value);
}
