import type { Response } from "express";
import { ZodError } from "zod";

export function error(res: Response, status: number, message: string): Response {
  return res.status(status).json({ error: message });
}

export function zodError(res: Response, err: ZodError): Response {
  const first = err.issues[0];
  return error(res, 400, first ? `${first.path.join(".")}: ${first.message}` : "Invalid input");
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Sends a safe response for an error caught in a route handler. `HttpError`s are
 *  operational errors we threw ourselves with a message that's safe to show a user,
 *  so their status/message pass through as-is. Anything else — an unexpected bug, a
 *  raw Prisma/db error, etc. — is logged server-side only; the client only ever sees
 *  the generic fallback, never internals like file paths or query details. */
export function serverError(res: Response, err: unknown, fallback: string): Response {
  if (err instanceof HttpError) return error(res, err.status, err.message);
  console.error(`[error] ${fallback}:`, err);
  return error(res, 500, fallback);
}

export function handleRouteError(res: Response, err: unknown, fallback = "Something went wrong"): Response {
  if (err instanceof ZodError) return zodError(res, err);
  return serverError(res, err, fallback);
}