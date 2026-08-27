import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = "0.0.0.0";

let apiReady = false;
let apiError = null;

// Railway healthcheck — must respond before heavy modules finish loading.
app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true, ready: apiReady });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "tailor-assistant-server",
    ready: apiReady,
  });
});

app.use(
  cors({
    origin: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "20mb" }));

async function mountApi() {
  const { createApiRouter } = await import("./api.js");
  app.use(createApiRouter());

  app.use((err, _req, res, _next) => {
    const status = err?.output?.statusCode ?? 500;
    const message = err?.output?.payload?.message ?? err?.message ?? "Error";
    res.status(status).json({ error: message });
  });

  apiReady = true;
  console.log("API routes ready");
}

const server = app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port} (PORT=${port})`);
  mountApi().catch((err) => {
    apiError = err;
    console.error("Failed to mount API routes:", err);
    console.error(
      "Check Railway Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_API_KEY, API_AUTH_TOKEN, MACHINE_BRAND, MACHINE_MODEL"
    );
  });
});

server.on("error", (err) => {
  console.error("Server listen error:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});
