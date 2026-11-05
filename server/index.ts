import "dotenv/config";
import express from "express";
import cors from "cors";
import { errorMiddleware } from "./lib/http";
import { webhookRouter } from "./routes/webhooks";
import { paymentsRouter } from "./routes/payments";
import { authRouter } from "./routes/auth";
import { readRouter } from "./routes/reads";
import { mutationRouter } from "./routes/mutations";
import { traderRouter } from "./routes/trader";

/**
 * The Luxytrades API. One Express app serves both surfaces:
 *   • /api/trader/*    — the trader (mobile) app: real accounts, trading, funds.
 *   • /admin/api/*     — the back-office console: reads + privileged mutations.
 *
 * In production this is hosted as a single Vercel serverless function (api/index.ts);
 * `app.listen` only ever runs for local development.
 */
export const app = express();
const BASE = "/admin/api";

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
    credentials: false,
  }),
);

// 1) Webhooks first — they need the RAW body for HMAC verification and must NOT be
//    JSON-parsed (and carry no bearer token, so they mount before auth).
app.use(webhookRouter);

// 2) Everything else parses JSON.
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// 2b) Public M-Pesa STK push endpoints (trader-issued push + Safaricom callback).
//     Mounted after the JSON parser so Daraja's callback body is available.
app.use("/api/payments/mpesa", paymentsRouter);

// 2c) Trader-facing API (auth endpoints are public; the rest need a trader token).
app.use("/api/trader", traderRouter);

// 3) Authenticated admin surface.
app.use(BASE, authRouter);
app.use(BASE, readRouter);
app.use(BASE, mutationRouter);

app.use(errorMiddleware);

// Local development / self-hosted: bind a port. On Vercel the platform invokes the
// exported app per request, so we must never call listen there.
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT ?? 4000);
  app.listen(PORT, () => {
    console.log(`Luxytrades API → http://localhost:${PORT}  (env: ${process.env.NODE_ENV ?? "development"})`);
  });
}

export default app;
