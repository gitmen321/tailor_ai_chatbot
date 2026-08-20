import "dotenv/config";
import express from "express";
import cors from "cors";
import { createApiRouter } from "./api.js";

const app = express();

app.use(
  cors({
    origin: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(
  express.json({
    limit: "20mb",
  })
);

app.use(createApiRouter());

// Minimal error handler for Boom + generic errors.
app.use((err, _req, res, _next) => {
  const status = err?.output?.statusCode ?? 500;
  const message = err?.output?.payload?.message ?? err?.message ?? "Error";
  res.status(status).json({ error: message });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});

