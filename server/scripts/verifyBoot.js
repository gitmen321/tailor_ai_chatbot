import "dotenv/config";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const serverDir = fileURLToPath(new URL("..", import.meta.url));
const verifyPort = process.env.VERIFY_PORT ?? "3099";

const defaults = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE5MDAwMDAwMDB9.test",
  MACHINE_BRAND: "Test",
  MACHINE_MODEL: "test",
  API_AUTH_TOKEN: "verify-token",
  GOOGLE_API_KEY: "verify-key",
};

const env = { ...process.env, PORT: verifyPort };
for (const [key, value] of Object.entries(defaults)) {
  if (!env[key]) env[key] = value;
}

await import("../src/db/supabaseClient.js");
console.log("supabase client loaded");

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["src/index.js"], {
    cwd: serverDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let settled = false;
  const finish = (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    child.kill();
    if (error) reject(error);
    else resolve();
  };

  const timer = setTimeout(
    () => finish(new Error("Server boot timed out after 15s")),
    15000
  );

  child.stdout.on("data", async (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    if (!text.includes("listening") || settled) return;

    try {
      const res = await fetch(`http://127.0.0.1:${verifyPort}/api/health`);
      if (!res.ok) throw new Error(`Health check failed (${res.status})`);
      const body = await res.json();
      if (!body.ok) throw new Error("Health check returned unexpected body");
      console.log("health check OK");
      finish();
    } catch (err) {
      finish(err);
    }
  });

  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  child.on("error", finish);

  child.on("exit", (code) => {
    if (!settled) finish(new Error(`Server exited before health check (${code})`));
  });
});

console.log("server boot verify passed");
