import type { NextFunction, Request, RequestHandler, Response } from "express";

/** A thrown HTTP error carrying a status code the error middleware turns into JSON. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Wrap an async route handler so rejections reach the error middleware. */
export function handler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Terminal error handler — never leak stack traces to the client. */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Zod validation errors surface as 400 with the issue list.
  const anyErr = err as { name?: string; issues?: unknown[]; message?: string };
  if (anyErr?.name === "ZodError") {
    res.status(400).json({ error: "Validation failed", issues: anyErr.issues });
    return;
  }
  if (process.env.NODE_ENV !== "production") console.error("[api]", err);
  res.status(500).json({ error: "Internal server error" });
}

/** Best-effort client IP for the audit trail (respects proxy headers). */
export function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}
