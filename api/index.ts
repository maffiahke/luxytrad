/**
 * Vercel serverless entry point.
 *
 * The whole API (trader + admin, plus the Safaricom webhook/callback) lives in a
 * single Express app. Vercel routes `/api/*` and `/admin/api/*` here (see
 * vercel.json) and invokes the exported app as a Node request listener — the
 * original request URL is preserved, so Express routes exactly as it does locally.
 */
import app from "../server/index";

export default app;
