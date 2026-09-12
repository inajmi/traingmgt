import { createTransport, Transporter } from "nodemailer";

import { prisma } from "../db";
import { config } from "../env";
import { decryptSecret, encryptSecret } from "./crypto";

const SETTINGS_ID = "singleton";
const MIN_TIMEOUT_MINUTES = 5;
const MAX_TIMEOUT_MINUTES = 60 * 24 * 90; // 90 days

/** Parses simple "7d" / "12h" / "30m" style durations (as used by JWT_EXPIRES_IN) into minutes. */
function parseDurationToMinutes(value: string, fallbackMinutes: number): number {
  const m = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!m) return fallbackMinutes;
  const n = Number(m[1]);
  const unit = m[2];
  const minutes = unit === "s" ? n / 60 : unit === "m" ? n : unit === "h" ? n * 60 : n * 60 * 24;
  return Math.round(minutes) || fallbackMinutes;
}

export type PublicSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  smtpPassSet: boolean;
  sessionTimeoutMinutes: number;
};

let cached: Awaited<ReturnType<typeof prisma.systemSetting.findUnique>> | null = null;
let transporter: Transporter | null | undefined;

/** Creates the settings row from env defaults on first boot if it doesn't exist yet. */
export async function ensureSystemSettings(): Promise<void> {
  const existing = await prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return;
  await prisma.systemSetting.create({
    data: {
      id: SETTINGS_ID,
      smtpHost: config.smtp.host || null,
      smtpPort: config.smtp.port,
      smtpUser: config.smtp.user || null,
      smtpPassEncrypted: config.smtp.pass ? encryptSecret(config.smtp.pass) : null,
      smtpFrom: config.smtp.from,
      sessionTimeoutMinutes: parseDurationToMinutes(config.jwtExpiresIn, 10080),
    },
  });
}

async function getRow() {
  if (!cached) {
    cached = await prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
  }
  return cached;
}

function invalidate(): void {
  cached = null;
  transporter = undefined;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const row = await getRow();
  return {
    smtpHost: row?.smtpHost ?? "",
    smtpPort: row?.smtpPort ?? 587,
    smtpSecure: row?.smtpSecure ?? false,
    smtpUser: row?.smtpUser ?? "",
    smtpFrom: row?.smtpFrom ?? "",
    smtpPassSet: !!row?.smtpPassEncrypted,
    sessionTimeoutMinutes: row?.sessionTimeoutMinutes ?? 10080,
  };
}

export async function getSessionTimeoutMinutes(): Promise<number> {
  const row = await getRow();
  return row?.sessionTimeoutMinutes ?? 10080;
}

export type SettingsPatch = {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpFrom?: string;
  /** Undefined = leave unchanged, "" = clear, non-empty = replace. */
  smtpPass?: string;
  sessionTimeoutMinutes?: number;
};

export async function updateSettings(patch: SettingsPatch): Promise<PublicSettings> {
  const data: Record<string, unknown> = {};
  if (patch.smtpHost !== undefined) data.smtpHost = patch.smtpHost || null;
  if (patch.smtpPort !== undefined) data.smtpPort = patch.smtpPort;
  if (patch.smtpSecure !== undefined) data.smtpSecure = patch.smtpSecure;
  if (patch.smtpUser !== undefined) data.smtpUser = patch.smtpUser || null;
  if (patch.smtpFrom !== undefined) data.smtpFrom = patch.smtpFrom || null;
  if (patch.smtpPass !== undefined) data.smtpPassEncrypted = patch.smtpPass === "" ? null : encryptSecret(patch.smtpPass);
  if (patch.sessionTimeoutMinutes !== undefined) {
    data.sessionTimeoutMinutes = Math.min(MAX_TIMEOUT_MINUTES, Math.max(MIN_TIMEOUT_MINUTES, patch.sessionTimeoutMinutes));
  }

  await prisma.systemSetting.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
  invalidate();
  return getPublicSettings();
}

export async function smtpConfigured(): Promise<boolean> {
  const row = await getRow();
  return !!row?.smtpHost;
}

/** Returns a ready nodemailer transport, or null when SMTP isn't configured. Cached
 *  until settings change so we don't rebuild a connection pool per email. */
export async function getSmtpTransport(): Promise<{ transport: Transporter; from: string } | null> {
  const row = await getRow();
  if (!row?.smtpHost) return null;
  if (transporter === undefined) {
    transporter = createTransport({
      host: row.smtpHost,
      port: row.smtpPort,
      secure: row.smtpSecure,
      auth: row.smtpUser ? { user: row.smtpUser, pass: row.smtpPassEncrypted ? decryptSecret(row.smtpPassEncrypted) : "" } : undefined,
    });
  }
  return { transport: transporter!, from: row.smtpFrom || "no-reply@example.com" };
}
