import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const prisma = new PrismaClient();

type SeedTrainer = {
  itsId?: string;
  name: string;
  profession?: string | number;
  phone?: string;
  email?: string;
  surveyExpertise?: string;
  surveyTopics?: string;
  surveyFormat?: string;
  surveyDayAvailability?: string;
  meetingStatus?: string;
  meetingDate?: string;
  willingness?: string;
  freeTraining?: string;
  fee?: string;
  finalTopics?: string;
  preferredFormat?: string;
  preferredDays?: string;
  preferredTime?: string;
  maxSessions?: string;
  minNotice?: string;
  languages?: string;
  constraints?: string;
  followUp?: string;
};

function loadSeed(): SeedTrainer[] {
  const file = path.join(__dirname, "trainers-seed.json");
  if (!fs.existsSync(file)) {
    console.error("Missing trainers-seed.json — run the extraction step or restore the file.");
    return [];
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as SeedTrainer[];
}

function norm(v: string | number | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function main(): Promise<void> {
  const seed = loadSeed();
  let created = 0;

  for (const t of seed) {
    const email = norm(t.email);
    const existing = email
      ? await prisma.trainer.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })
      : await prisma.trainer.findFirst({ where: { itsId: norm(t.itsId) ?? "" } });

    if (existing) {
      // Update the read-only reference fields and meeting notes if they changed.
      await prisma.trainer.update({
        where: { id: existing.id },
        data: {
          itsId: norm(t.itsId) ?? existing.itsId,
          name: norm(t.name) ?? existing.name,
          phone: norm(t.phone) ?? existing.phone,
          profession: norm(t.profession) ?? existing.profession,
          surveyExpertise: norm(t.surveyExpertise) ?? existing.surveyExpertise,
          surveyTopics: norm(t.surveyTopics) ?? existing.surveyTopics,
          surveyFormat: norm(t.surveyFormat) ?? existing.surveyFormat,
          surveyDayAvailability: norm(t.surveyDayAvailability) ?? existing.surveyDayAvailability,
        },
      });
      continue;
    }

    await prisma.trainer.create({
      data: {
        itsId: norm(t.itsId),
        name: t.name.trim(),
        phone: norm(t.phone),
        email,
        profession: norm(t.profession),
        surveyExpertise: norm(t.surveyExpertise),
        surveyTopics: norm(t.surveyTopics),
        surveyFormat: norm(t.surveyFormat),
        surveyDayAvailability: norm(t.surveyDayAvailability),
        // meeting notes + editable fields all start blank
        finalTopics: norm(t.finalTopics),
        preferredFormat: norm(t.preferredFormat),
        preferredDays: norm(t.preferredDays),
        preferredTime: norm(t.preferredTime),
        minNotice: norm(t.minNotice),
        languages: norm(t.languages),
        constraints: norm(t.constraints),
        meetingStatus: norm(t.meetingStatus),
        willingness: norm(t.willingness),
        freeTraining: norm(t.freeTraining),
        fee: norm(t.fee),
        followUp: norm(t.followUp),
      },
    });
    created += 1;
  }

  console.log(`Seed complete: ${created} trainer(s) created, ${seed.length} total in seed file.`);
}

main()
  .catch((err) => {
    console.error("seed failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());