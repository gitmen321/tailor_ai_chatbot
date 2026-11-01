import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveApiBase } from "../src/apiBase.js";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const netlifyToml = readFileSync(join(webDir, "netlify.toml"), "utf8");

const bakedApiUrl = /^\s*VITE_SERVER_API_URL\s*=/m.test(netlifyToml);
if (bakedApiUrl) {
  throw new Error(
    "web/netlify.toml must not set VITE_SERVER_API_URL — the PWA should use same-origin /api (Netlify proxy)."
  );
}

if (
  !netlifyToml.includes('from = "/api/*"') ||
  !netlifyToml.includes("supabase.co/functions/v1/api/:splat")
) {
  throw new Error("web/netlify.toml must proxy /api/* to the Supabase Edge Function.");
}

const cases = [
  { configured: "", hostname: "localhost", expected: "" },
  { configured: "", hostname: "mellow-lily-dc4d1e.netlify.app", expected: "" },
  {
    configured: "http://localhost:8787",
    hostname: "mellow-lily-dc4d1e.netlify.app",
    expected: "",
  },
  {
    configured: "https://tailoraichatbot-production.up.railway.app:3888",
    hostname: "mellow-lily-dc4d1e.netlify.app",
    expected: "https://tailoraichatbot-production.up.railway.app",
  },
  {
    configured: "https://vdohxjqzczhmgfuedrwj.supabase.co/functions/v1",
    hostname: "mellow-lily-dc4d1e.netlify.app",
    expected: "https://vdohxjqzczhmgfuedrwj.supabase.co/functions/v1",
  },
];

for (const { configured, hostname, expected } of cases) {
  const actual = resolveApiBase(configured, hostname);
  if (actual !== expected) {
    throw new Error(
      `resolveApiBase(${JSON.stringify(configured)}, ${JSON.stringify(hostname)}) => ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`
    );
  }
}

console.log("production API routing checks passed");
