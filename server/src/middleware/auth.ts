import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

import { prisma } from "../db";
import { config } from "../env";
import { error } from "../lib/http";

export const COOKIE_NAME = "tt_token";

export type AuthedUser = {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "TRAINER";
  status: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export function signToken(user: { id: string; role: string }): string {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", path: "/" });
}

export function getPayload(req: Request): JwtPayload | null {
  const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const payload = getPayload(req);
  if (!payload?.sub) {
    error(res, 401, "Not authenticated");
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub as string } });
  if (!user) {
    error(res, 401, "Not authenticated");
    return;
  }
  req.user = { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status };
  next();
}

export function requireActive(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    error(res, 401, "Not authenticated");
    return;
  }
  if (req.user.status !== "ACTIVE") {
    if (req.user.status === "PENDING") {
      error(res, 403, "Your account is pending admin approval");
    } else if (req.user.status === "REJECTED") {
      error(res, 403, "Your registration was not approved");
    } else {
      error(res, 403, "Your account is disabled");
    }
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    error(res, 401, "Not authenticated");
    return;
  }
  if (req.user.role !== "ADMIN") {
    error(res, 403, "Admins only");
    return;
  }
  next();
}