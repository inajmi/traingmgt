import path from "path";

import dotenv from "dotenv";

// npm workspaces run scripts with cwd = package dir (server/), so this resolves server/.env.
dotenv.config({ path: path.join(process.cwd(), ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env"), override: false });

function str(name: string, fallback: string): string {
  const v = process.env[name];
  return v !== undefined && v !== "" ? v : fallback;
}

function int(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const INSECURE_JWT_SECRET_DEFAULT = "insecure-dev-secret-change-me";
const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = str("JWT_SECRET", INSECURE_JWT_SECRET_DEFAULT);

if (isProduction && jwtSecret === INSECURE_JWT_SECRET_DEFAULT) {
  throw new Error("JWT_SECRET must be set to a strong, unique value in production (refusing to start with the insecure default).");
}

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret,
  jwtExpiresIn: str("JWT_EXPIRES_IN", "7d"),
  port: int("PORT", 3000),
  appBaseUrl: str("APP_BASE_URL", "http://localhost:3000"),
  appTz: str("APP_TZ", "Asia/Dubai"),
  adminEmail: str("ADMIN_EMAIL", ""),
  adminPassword: str("ADMIN_PASSWORD", ""),
  clientDist: str("CLIENT_DIST", path.join(process.cwd(), "..", "client", "dist")),
  smtp: {
    host: str("SMTP_HOST", ""),
    port: int("SMTP_PORT", 587),
    user: str("SMTP_USER", ""),
    pass: str("SMTP_PASS", ""),
    from: str("SMTP_FROM", "no-reply@example.com"),
  },
  isProduction,
};