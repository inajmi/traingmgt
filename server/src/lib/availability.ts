import { AvailStatus } from "@prisma/client";

import { prisma } from "../db";
import { MONTHS } from "./constants";

export const AVAIL_VALUES = ["Available", "Limited", "Holiday", "Unavailable"] as const;

export type AvailabilityEntry = { month: string; status: string };

export function isAvailValue(v: string): v is AvailStatus {
  return (AVAIL_VALUES as readonly string[]).includes(v);
}

export async function getAvailabilityYear(trainerId: string, year: number): Promise<AvailabilityEntry[]> {
  const rows = await prisma.availability.findMany({
    where: { trainerId, year },
    orderBy: { month: "asc" },
  });
  return MONTHS.map((month) => {
    const row = rows.find((r) => r.month === month);
    return { month, status: row?.status ?? "" };
  });
}

export async function putAvailabilityYear(
  trainerId: string,
  year: number,
  entries: AvailabilityEntry[],
): Promise<void> {
  const upserts = entries
    .filter((e): e is AvailabilityEntry & { status: AvailStatus } => isAvailValue(e.status))
    .map((e) =>
      prisma.availability.upsert({
        where: { trainerId_year_month: { trainerId, year, month: e.month } },
        update: { status: e.status },
        create: { trainerId, year, month: e.month, status: e.status },
      }),
    );
  const deletes = entries
    .filter((e) => e.status === "")
    .map((e) => prisma.availability.deleteMany({ where: { trainerId, year, month: e.month } }));
  await prisma.$transaction([...upserts, ...deletes]);
}