import { Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "../db";

// This script is run via `npm run create:admin -w server`, so cwd = server/.

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

function fail(msg: string): never {
  console.error(msg);
  console.error("Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in server/.env (see .env.example).");
  process.exit(1);
}

async function main(): Promise<void> {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("ADMIN_EMAIL is missing or invalid.");
  if (!password || password.length < 8) fail("ADMIN_PASSWORD is missing or shorter than 8 characters.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === Role.ADMIN) {
      console.log(`Admin already exists for ${email} — nothing to do.`);
      return;
    }
    fail(`A non-admin account already uses ${email}.`);
  }

  const passwordHash = await bcrypt.hash(password, 11);
  await prisma.user.create({
    data: { email, fullName: "Administrator", passwordHash, role: Role.ADMIN, status: UserStatus.ACTIVE },
  });
  console.log(`Created admin account: ${email}`);
}

main()
  .catch((err) => {
    console.error("create:admin failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());