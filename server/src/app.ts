import cookieParser from "cookie-parser";
import express from "express";
import fs from "fs";
import path from "path";

import { config } from "./env";
import { error } from "./lib/http";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { messagingRouter } from "./routes/messaging";
import { notificationsRouter } from "./routes/notifications";
import { sessionsRouter } from "./routes/sessions";
import { trainersRouter } from "./routes/trainers";

export function buildApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

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
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        next();
        return;
      }
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  // Final JSON error handler.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as { status?: number })?.status && (err as { status: number }).status < 500 ? (err as { status: number }).status : 500;
    error(res, status, (err as Error)?.message ?? "Server error");
  });

  return app;
}