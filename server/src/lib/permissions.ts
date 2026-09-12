import { NextFunction, Request, Response } from "express";
import { PermissionKey, Role } from "@prisma/client";

import { prisma } from "../db";
import { error } from "./http";

export const ADMINISTRATOR_ROLE_NAME = "Administrator";

export const PERMISSION_CATALOG: { key: PermissionKey; label: string; description: string }[] = [
  { key: "SETTINGS_MANAGE", label: "Manage system settings", description: "Configure the email server and sign-in session timeout." },
  { key: "USERS_MANAGE", label: "Manage users", description: "Create accounts, change roles, reset passwords, enable/disable accounts." },
  { key: "ROLES_MANAGE", label: "Manage roles", description: "Create, edit, and delete custom roles and their permissions." },
  { key: "TRAINERS_MANAGE", label: "Manage trainers", description: "Create and edit trainer profiles and availability." },
  { key: "SESSIONS_MANAGE", label: "Manage sessions", description: "Create, assign, edit, and cancel training sessions." },
  { key: "REGISTRATIONS_MANAGE", label: "Manage registrations", description: "Approve or reject trainer self-registrations." },
];

const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

/** Ensures a system "Administrator" role (all permissions) exists and that every
 *  ADMIN-kind user has an access role, defaulting new/legacy admins to it. */
export async function ensureDefaultAccessRoles(): Promise<void> {
  let admin = await prisma.accessRole.findUnique({ where: { name: ADMINISTRATOR_ROLE_NAME } });
  if (!admin) {
    admin = await prisma.accessRole.create({
      data: {
        name: ADMINISTRATOR_ROLE_NAME,
        isSystem: true,
        permissions: { create: ALL_PERMISSION_KEYS.map((permission) => ({ permission })) },
      },
    });
  } else {
    const existing = await prisma.accessRolePermission.findMany({ where: { roleId: admin.id }, select: { permission: true } });
    const have = new Set(existing.map((p) => p.permission));
    const missing = ALL_PERMISSION_KEYS.filter((k) => !have.has(k));
    if (missing.length > 0) {
      await prisma.accessRolePermission.createMany({
        data: missing.map((permission) => ({ roleId: admin!.id, permission })),
        skipDuplicates: true,
      });
    }
  }

  await prisma.user.updateMany({
    where: { role: Role.ADMIN, accessRoleId: null },
    data: { accessRoleId: admin.id },
  });
}

/** All permission keys held by a user (empty for trainers). Falls back to full
 *  access for an ADMIN-kind user with no role assigned, so a data glitch can't
 *  lock every admin out of the portal at once. */
export async function getUserPermissions(userId: string, role: Role): Promise<Set<PermissionKey>> {
  if (role !== Role.ADMIN) return new Set();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { accessRole: { include: { permissions: true } } },
  });
  if (!user?.accessRole) return new Set(ALL_PERMISSION_KEYS);
  return new Set(user.accessRole.permissions.map((p) => p.permission));
}

export function requirePermission(key: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      error(res, 401, "Not authenticated");
      return;
    }
    if (!req.user.permissions.has(key)) {
      console.warn(`[authz] user ${req.user.id} denied ${req.method} ${req.originalUrl} (missing ${key})`);
      error(res, 403, "You do not have permission to do this");
      return;
    }
    next();
  };
}
