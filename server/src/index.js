import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = "0.0.0.0";

let apiReady = false;
let apiError = null;

// Reflect the request Origin so Netlify, PWAs, and local Vite all work.
// Always include Authorization so chat/history preflights succeed.
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  })
);
app.options("*", cors());

app.use(express.json({ limit: "20mb" }));

function sendHealth(_req, res) {
  res.status(200).json({ ok: true, ready: apiReady });
}

// Railway healthcheck — must respond before heavy modules finish loading.
app.get("/api/health", sendHealth);
app.get("/health", sendHealth);

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "tailor-assistant-server",
    ready: apiReady,
  });
});

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
