import { Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "../db";

// This script is run via `npm run create:trainer-accounts -w server`, so cwd = server/.
// Creates login accounts for every imported Trainer that doesn't have a User yet.

function generateTempPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

interface CreatedAccount {
  email: string;
  tempPassword: string;
  name: string;
}

async function main(): Promise<void> {
  const trainers = await prisma.trainer.findMany({
    where: { userId: null },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${trainers.length} trainer(s) without a user account.\n`);

  const created: CreatedAccount[] = [];
  const skippedNoEmail: string[] = [];
  const skippedEmailInUse: string[] = [];
  const failed: string[] = [];

  for (const trainer of trainers) {
    const email = trainer.email?.trim().toLowerCase();
    if (!email) {
      skippedNoEmail.push(trainer.name);
      console.log(`SKIP (no email): ${trainer.name}`);
      continue;
    }

    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        skippedEmailInUse.push(`${trainer.name} <${email}>`);
        console.log(`SKIP (email already in use): ${trainer.name} <${email}>`);
        continue;
      }

      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 11);

      const user = await prisma.user.create({
        data: {
          email,
          fullName: trainer.name,
          phone: trainer.phone,
          profession: trainer.profession,
          itsId: trainer.itsId,
          role: Role.TRAINER,
          status: UserStatus.ACTIVE,
          mustChangePassword: true,
          passwordHash,
        },
      });

      await prisma.trainer.update({
        where: { id: trainer.id },
        data: { userId: user.id },
      });

      created.push({ email, tempPassword, name: trainer.name });
      console.log(`Created ${email} for ${trainer.name}`);
    } catch (err) {
      failed.push(`${trainer.name} <${email}>`);
      console.error(`FAILED ${trainer.name} <${email}>:`, err instanceof Error ? err.message : err);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Created: ${created.length}`);
  console.log(`Skipped (no email): ${skippedNoEmail.length}`);
  console.log(`Skipped (email already in use): ${skippedEmailInUse.length}`);
  if (failed.length) console.log(`Failed: ${failed.length}`);

  if (created.length) {
    console.log("\n=== Accounts (email | temp password | trainer name) ===");
    for (const a of created) {
      console.log(`${a.email} | ${a.tempPassword} | ${a.name}`);
    }
  }
}

main()
  .catch((err) => {
    console.error("create:trainer-accounts failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
