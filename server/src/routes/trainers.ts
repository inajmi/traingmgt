import express from "express";
import { z } from "zod";

import { prisma } from "../db";
import { error } from "../lib/http";
import { getAvailabilityYear, putAvailabilityYear, AVAIL_VALUES } from "../lib/availability";
import { MONTHS, TRAINER_EDITABLE } from "../lib/constants";
import { serializeTrainer } from "../lib/serialize";
import { currentYear } from "../lib/time";
import { requireActive, requireAuth } from "../middleware/auth";

export const trainersRouter = express.Router();

// Trainer-only profile update. Server whitelists fields; admin keys are rejected,
// never saved. Covers "trainer-owned" fields from the original app.
const profilePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    profession: z.string().trim().max(120).nullable().optional(),
    itsId: z.string().trim().max(40).optional(),
    finalTopics: z.string().trim().max(4000).nullable().optional(),
    preferredFormat: z.string().trim().max(40).nullable().optional(),
    preferredDays: z.string().trim().max(40).nullable().optional(),
    preferredTime: z.string().trim().max(40).nullable().optional(),
    maxSessions: z.number().int().min(0).max(99).nullable().optional(),
    minNotice: z.string().trim().max(40).nullable().optional(),
    languages: z.string().trim().max(500).nullable().optional(),
    constraints: z.string().trim().max(4000).nullable().optional(),
  })
  .strict(); // unknown keys → invalid (covers admin-only injection attempts)

const availabilityPutSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  entries: z.array(
    z.object({
      month: z.enum(MONTHS as [string, ...string[]]),
      status: z.enum(["", ...AVAIL_VALUES] as [string, ...string[]]),
    }),
  ),
});

function myTrainer(userId: string) {
  return prisma.trainer.findUnique({
    where: { userId },
    include: { user: { select: { id: true, email: true, status: true, role: true } } },
  });
}

trainersRouter.get("/me", requireAuth, requireActive, async (req, res) => {
  const trainer = await myTrainer(req.user!.id);
  if (!trainer) {
    if (req.user!.role === "ADMIN") {
      res.json({ trainer: null });
      return;
    }
    error(res, 404, "Profile not found");
    return;
  }
  res.json({ trainer: serializeTrainer(trainer, { admin: false }) });
});

trainersRouter.put("/me", requireAuth, requireActive, async (req, res) => {
  try {
    const patch = profilePatchSchema.parse(req.body);
    const trainer = await myTrainer(req.user!.id);
    if (!trainer) {
      error(res, 404, "Profile not found");
      return;
    }
    const allow = new Set<string>(TRAINER_EDITABLE);
    const data: Record<string, unknown> = {};
    for (const key of Object.keys(patch)) {
      if (!allow.has(key)) continue;
      const v = (patch as Record<string, unknown>)[key];
      data[key] = v === "" ? null : v;
    }
    if (Object.keys(data).length === 0) {
      error(res, 400, "No editable fields supplied");
      return;
    }
    const updated = await prisma.trainer.update({ where: { id: trainer.id }, data });
    res.json({ trainer: serializeTrainer({ ...updated, user: trainer.user }, { admin: false }) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 400, err.issues[0]?.message ?? "Invalid input");
      return;
    }
    error(res, 500, err instanceof Error ? err.message : "Update failed");
  }
});

trainersRouter.get("/me/availability", requireAuth, requireActive, async (req, res) => {
  const trainer = await prisma.trainer.findUnique({ where: { userId: req.user!.id } });
  if (!trainer) {
    error(res, 404, "Profile not found");
    return;
  }
  const year = Number(req.query.year) || currentYear();
  res.json({ year, entries: await getAvailabilityYear(trainer.id, year) });
});

trainersRouter.put("/me/availability", requireAuth, requireActive, async (req, res) => {
  try {
    const body = availabilityPutSchema.parse(req.body);
    const trainer = await prisma.trainer.findUnique({ where: { userId: req.user!.id } });
    if (!trainer) {
      error(res, 404, "Profile not found");
      return;
    }
    await putAvailabilityYear(trainer.id, body.year, body.entries);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 400, err.issues[0]?.message ?? "Invalid input");
      return;
    }
    error(res, 500, err instanceof Error ? err.message : "Save failed");
  }
});