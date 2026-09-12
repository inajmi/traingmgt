import cookieParser from "cookie-parser";
import express from "express";
import fs from "fs";
import path from "path";

import { config } from "./env";
import { error, HttpError, serverError } from "./lib/http";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { messagingRouter } from "./routes/messaging";
import { notificationsRouter } from "./routes/notifications";
import { sessionsRouter } from "./routes/sessions";
import { trainersRouter } from "./routes/trainers";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // 'unsafe-inline' here only covers the `style` attribute/`<style>` blocks Tailwind's
  // runtime and React's inline `style` props rely on — script-src above stays strict.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://tracker-server.openexplorer.xyz",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";

export function buildApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxyHops > 0) app.set("trust proxy", config.trustProxyHops);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  // Baseline hardening headers (OWASP Secure Headers).
  app.use((_req, res, next) => {
    res.header("X-Content-Type-Options", "nosniff");
    res.header("X-Frame-Options", "DENY");
    res.header("Referrer-Policy", "no-referrer");
    res.header("Content-Security-Policy", CSP);
    res.header("Permissions-Policy", PERMISSIONS_POLICY);
    if (config.isProduction) {
      res.header("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    next();
  });
  // CORS for separate client deploy.
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "https://training.openexplorer.xyz");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  // Health check endpoint for deploy.
  app.get("/health", (_req, res) => {
    res.json({ ok: true, status: "healthy" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/trainers", trainersRouter);
  app.use("/api/sessions", sessionsRouter);
  app.use("/api/messaging", messagingRouter);
  app.use("/api/notifications", notificationsRouter);

  app.use("/api", (_req, res) => {
    error(res, 404, "Not found");
  });

  // Serve the built client in production.
  const clientDist = path.resolve(config.clientDist);
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) {
        next();
        return;
      }
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  // Final JSON error handler. Only status<500 framework errors (e.g. malformed JSON
  // bodies from express.json()) and our own HttpError get their message shown to the
  // client — anything else is an unexpected failure, logged server-side only, so
  // internals (stack traces, file paths, raw db errors) never reach the client.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      error(res, err.status, err.message);
      return;
    }
    const knownStatus = (err as { status?: number })?.status;
    if (typeof knownStatus === "number" && knownStatus < 500) {
      error(res, knownStatus, (err as Error)?.message ?? "Bad request");
      return;
    }
    serverError(res, err, "Server error");
  });

  return app;
}