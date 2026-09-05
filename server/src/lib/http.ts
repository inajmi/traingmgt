import type { Response } from "express";
import { ZodError } from "zod";

export function error(res: Response, status: number, message: string): Response {
  return res.status(status).json({ error: message });
}

export function zodError(res: Response, err: ZodError): Response {
  const first = err.issues[0];
  return error(res, 400, first ? `${first.path.join(".")}: ${first.message}` : "Invalid input");
}

export function handleRouteError(res: Response, err: unknown, fallback = "Something went wrong"): Response {
  if (err instanceof ZodError) return zodError(res, err);
  // keep original message for known operational errors thrown as Error
  return error(res, 500, err instanceof Error && err.message ? err.message : fallback);
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}