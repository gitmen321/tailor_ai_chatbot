import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, "server", ".env");
const denoBin = join(process.env.USERPROFILE || "", ".deno", "bin", "deno.exe");

function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function resolveDeno() {
  if (existsSync(denoBin)) return denoBin;
  return "deno";
}

function normalizeApiPath(pathname) {
  let p = pathname || "/";
  if (p.startsWith("/functions/v1/api")) p = p.slice("/functions/v1/api".length);
  else if (p.startsWith("/api")) p = p.slice("/api".length);
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}

const pathCases = [
  ["/functions/v1/api/chat", "/chat"],
  ["/functions/v1/api/health", "/health"],
  ["/api/chat", "/chat"],
  ["/api/transcribe", "/transcribe"],
  ["/health", "/health"],
  ["/functions/v1/api", "/"],
];

for (const [input, expected] of pathCases) {
  const actual = normalizeApiPath(input);
  if (actual !== expected) {
    throw new Error(`normalizeApiPath(${input}) => ${actual}, expected ${expected}`);
  }
}
console.log("path routing checks passed");

const env = parseEnvFile(envPath);
const missing = ["GOOGLE_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "API_AUTH_TOKEN", "MACHINE_BRAND", "MACHINE_MODEL"].filter(
  (k) => !env[k],
);
if (missing.length) {
  throw new Error(`server/.env missing: ${missing.join(", ")}`);
}

const port = 8787;
const origin = `http://127.0.0.1:${port}`;
const deno = resolveDeno();
const child = spawn(
  deno,
  [
    "run",
    "--allow-net",
    "--allow-env",
    "--allow-read",
    `--env-file=${envPath}`,
    join(root, "supabase", "functions", "api", "index.ts"),
  ],
  {
    cwd: root,
    env: { ...process.env, ...env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let ready = false;
const bootLog = [];
let spawnError = null;

function onChunk(buf) {
  const text = buf.toString();
  bootLog.push(text);
  if (/Listening on|Deno\.serve|function runtime/i.test(text)) ready = true;
}

child.stdout.on("data", onChunk);
child.stderr.on("data", onChunk);
child.on("error", (err) => {
  spawnError = err;
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    if (spawnError) {
      throw new Error(
        `Could not start Deno (${spawnError.code ?? spawnError.message}). Install Deno or run this check through the Supabase CLI.`,
      );
    }
    try {
      const res = await fetch(`${origin}/api/health`);
      if (res.ok) return res;
    } catch {
      /* still booting */
    }
    await sleep(250);
  }
  throw new Error(`Edge function did not become ready.\n${bootLog.join("")}`);
}

let failed = false;
try {
  const healthRes = await waitForHealth();
  const health = await healthRes.json();
  if (!health.ok) throw new Error(`health not ok: ${JSON.stringify(health)}`);
  if (health.runtime !== "supabase-edge") {
    throw new Error(`expected supabase-edge runtime, got ${health.runtime}`);
  }
  console.log("GET /api/health ok", health);

  const unauth = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ webUserId: "test", text: "hi" }),
  });
  if (unauth.status !== 401) {
    throw new Error(`expected 401 without token, got ${unauth.status}`);
  }
  console.log("POST /api/chat without token -> 401 ok");

  const cors = await fetch(`${origin}/api/chat`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://mellow-lily-dc4d1e.netlify.app",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  if (![200, 204].includes(cors.status)) {
    throw new Error(`CORS preflight failed: ${cors.status}`);
  }
  if (!cors.headers.get("access-control-allow-origin")) {
    throw new Error("CORS missing Access-Control-Allow-Origin");
  }
  console.log("OPTIONS CORS preflight ok");

  const chatRes = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.API_AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      webUserId: `edge-test-${Date.now()}`,
      text: "ഹലോ, യൂഷ ക്വിക്ക് സ്റ്റിച്ച് മെഷീൻ straight stitch ആണോ?",
    }),
  });
  const chatText = await chatRes.text();
  if (!chatRes.ok) {
    throw new Error(`chat failed (${chatRes.status}): ${chatText.slice(0, 400)}`);
  }
  const chat = JSON.parse(chatText);
  if (!chat.reply || typeof chat.reply !== "string") {
    throw new Error(`chat missing reply: ${chatText.slice(0, 400)}`);
  }
  console.log("POST /api/chat ok, reply length", chat.reply.length);

  const historyRes = await fetch(
    `${origin}/api/history?webUserId=${encodeURIComponent("edge-history-check")}`,
    { headers: { Authorization: `Bearer ${env.API_AUTH_TOKEN}` } },
  );
  if (!historyRes.ok) {
    throw new Error(`history failed (${historyRes.status}): ${await historyRes.text()}`);
  }
  const history = await historyRes.json();
  if (!Array.isArray(history.messages)) {
    throw new Error("history.messages is not an array");
  }
  console.log("GET /api/history ok");
} catch (err) {
  failed = true;
  console.error(err instanceof Error ? err.message : err);
} finally {
  child.kill();
}

if (failed) process.exit(1);
console.log("edge function local tests passed — Railway is not required for the API");
