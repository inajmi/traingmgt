import { MessageKind, Prisma, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";

import { prisma } from "../db";
import { error, HttpError, handleRouteError } from "../lib/http";
import { notifySystem } from "../lib/notify";
import { getUserPermissions } from "../lib/permissions";
import {
  clearAuthCookie,
  requireActive,
  requireAuth,
  setAuthCookie,
  signToken,
} from "../middleware/auth";

export const authRouter = express.Router();

const BCRYPT_ROUNDS = 11;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Compared against on login when no account matches the email, so an invalid
// password on a real account and a nonexistent account take about the same
// time (bcrypt.compare dominates the response time either way) and the two
// cases can't be told apart by timing.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-account-password", BCRYPT_ROUNDS);

function makeLimiter(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });
}

const loginLimiter = makeLimiter(20);
// Stricter than login: these are rarely-legitimate-repeated actions, and register
// additionally runs a bcrypt(cost=11) hash + DB write per unauthenticated request.
const registerLimiter = makeLimiter(10);
const requestResetLimiter = makeLimiter(10);

export function serializeUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
}) {
  return {
    id: user.id,
    email: user.email.toLowerCase(),
    fullName: user.fullName,
    role: user.role.toLowerCase(),
    status: user.status.toLowerCase(),
    mustChangePassword: user.mustChangePassword,
  };
}

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().toLowerCase().regex(EMAIL_RE, "Invalid email"),
  phone: z.string().trim().max(40).optional().default(""),
  profession: z.string().trim().max(120).optional().default(""),
  itsId: z.string().trim().max(40).optional().default(""),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const REGISTER_RESPONSE = { ok: true, message: "If this email is eligible, your registration has been submitted for approval." };

authRouter.post("/register", registerLimiter, async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    // Always respond the same way whether or not the email is taken, so
    // registration can't be used to enumerate accounts.
    if (existing) {
      res.status(201).json(REGISTER_RESPONSE);
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    await prisma.user.create({
      data: {
        email: body.email,
        fullName: body.fullName,
        passwordHash,
        role: Role.TRAINER,
        status: UserStatus.PENDING,
        phone: body.phone || null,
        profession: body.profession || null,
        itsId: body.itsId || null,
      },
    });

    // Let admins know a registration is waiting.
    const admins = await prisma.user.findMany({ where: { role: Role.ADMIN, status: UserStatus.ACTIVE } });
    if (admins.length > 0) {
      await notifySystem(
        admins.map((a) => a.id),
        `New trainer registration: ${body.fullName} (${body.email}${body.itsId ? `, ITS ${body.itsId}` : ""}). Waiting for approval.`,
        MessageKind.SYSTEM_APPROVED,
        { subject: "New registration" },
      );
    }

    res.status(201).json(REGISTER_RESPONSE);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Lost a race with a concurrent registration for the same email — same generic response.
      res.status(201).json(REGISTER_RESPONSE);
      return;
    }
    handleRouteError(res, err, "Register failed");
  }
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().regex(EMAIL_RE, "Invalid email"),
  password: z.string().min(1),
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    const passwordOk = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordOk) {
      console.warn(`[auth] failed login attempt for ${body.email}`);
      throw new HttpError(401, "Invalid email or password");
    }
    if (user.status === UserStatus.PENDING) throw new HttpError(403, "Your account is pending admin approval");
    if (user.status === UserStatus.REJECTED) throw new HttpError(403, "Your registration was not approved");
    if (user.status === UserStatus.DISABLED) {
      console.warn(`[auth] login attempt on disabled account: ${user.email}`);
      throw new HttpError(403, "Your account is disabled");
    }

    const token = await signToken(user);
    await setAuthCookie(res, token);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const permissions = await getUserPermissions(user.id, user.role);
    res.json({ user: { ...serializeUser(user), permissions: [...permissions] } });
  } catch (err) {
    handleRouteError(res, err, "Login failed");
  }
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const full = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, fullName: true, role: true, status: true, mustChangePassword: true },
  });
  if (!full) {
    error(res, 404, "Account not found");
    return;
  }
  const permissions = await getUserPermissions(full.id, full.role);
  res.json({ user: { ...serializeUser(full), permissions: [...permissions] } });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});

authRouter.post("/change-password", requireAuth, requireActive, async (req, res) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new HttpError(401, "Not authenticated");
    if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
      throw new HttpError(400, "Current password is incorrect");
    }
    const hash = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, mustChangePassword: false, tokenVersion: { increment: 1 } },
    });
    // Bumping tokenVersion invalidates any other outstanding session tokens; re-issue
    // one for this request so the user making the change stays signed in.
    const token = await signToken(updated);
    await setAuthCookie(res, token);
    res.json({ ok: true });
  } catch (err) {
    handleRouteError(res, err, "Change failed");
  }
});

const requestResetSchema = z.object({ email: z.string().trim().toLowerCase().regex(EMAIL_RE, "Invalid email") });

authRouter.post("/request-reset", requestResetLimiter, async (req, res) => {
  try {
    const body = requestResetSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (user && user.status === UserStatus.ACTIVE) {
      const admins = await prisma.user.findMany({ where: { role: Role.ADMIN, status: UserStatus.ACTIVE } });
      if (admins.length > 0) {
        await notifySystem(
          admins.map((a) => a.id),
          `${user.fullName} (${user.email}) requested a password reset. Reset it from the trainer list.`,
          MessageKind.SYSTEM_RESET,
          { subject: "Password reset request" },
        );
      }
    }
    // Always succeed so addresses cannot be enumerated.
    res.json({ ok: true, message: "If the account exists, an admin has been notified." });
  } catch (err) {
    handleRouteError(res, err, "Request failed");
  }
});