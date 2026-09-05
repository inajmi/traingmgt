import { MessageKind, Role, SessionStatus, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import express from "express";
import { z } from "zod";

import { prisma } from "../db";
import { error, HttpError } from "../lib/http";
import { AVAIL_VALUES, getAvailabilityYear, putAvailabilityYear } from "../lib/availability";
import { MEETING_STATUSES, MONTHS, OPEN_TEXT_FIELDS } from "../lib/constants";
import { notifySystem } from "../lib/notify";
import { serializeTrainer } from "../lib/serialize";
import { currentYear } from "../lib/time";
import { requireActive, requireAdmin, requireAuth } from "../middleware/auth";
import { serializeUser } from "./auth";

export const adminRouter = express.Router();

adminRouter.use(requireAuth, requireActive, requireAdmin);

// ---- Dashboard KPIs -------------------------------------------------------

adminRouter.get("/kpis", async (req, res) => {
  const trainers = await prisma.trainer.findMany({ select: { meetingStatus: true, willingness: true, freeTraining: true } });
  const total = trainers.length;
  const completed = trainers.filter((t) => t.meetingStatus === "Completed").length;
  const regular = trainers.filter((t) => t.willingness === "Regularly").length;
  const volYes = trainers.filter((t) => t.freeTraining === "Yes – Volunteer").length;
  const notAvailable = trainers.filter((t) => t.willingness === "Not currently").length;
  const pendingRegistrations = await prisma.user.count({ where: { role: Role.TRAINER, status: UserStatus.PENDING } });
  const upcomingSessions = await prisma.session.count({
    where: { status: SessionStatus.SCHEDULED, startsAt: { gte: new Date() } },
  });
  res.json({ total, completed, regular, volYes, notAvailable, pendingRegistrations, upcomingSessions });
});

// ---- Registrations (self-registered trainers awaiting approval) -----------

adminRouter.get("/registrations", async (req, res) => {
  const filter = String(req.query.filter ?? "pending");
  const where: Record<string, unknown> = { role: Role.TRAINER };
  if (filter === "pending") where.status = UserStatus.PENDING;
  else if (filter === "approved") where.status = UserStatus.ACTIVE;
  else if (filter === "rejected") where.status = UserStatus.REJECTED;

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { trainer: { select: { id: true, name: true, itsId: true, email: true } } },
  });

  res.json({
    registrations: users.map((u) => ({
      ...serializeUser(u),
      fullName: u.fullName,
      phone: u.phone ?? "",
      profession: u.profession ?? "",
      itsId: u.itsId ?? "",
      createdAt: u.createdAt.toISOString(),
      trainerId: u.trainer?.id ?? null,
    })),
  });
});

const approveSchema = z.object({ linkedTrainerId: z.string().optional() });

adminRouter.post("/registrations/:id/approve", async (req, res) => {
  try {
    const body = approveSchema.parse(req.body ?? {});
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.role !== Role.TRAINER) {
      error(res, 404, "Registration not found");
      return;
    }
    if (user.status === UserStatus.ACTIVE) {
      error(res, 400, "Account is already approved");
      return;
    }

    // Prefer an explicit (seed) trainer, else match by email, else create a profile.
    let trainer = null;
    if (body.linkedTrainerId) {
      trainer = await prisma.trainer.findUnique({ where: { id: body.linkedTrainerId } });
      if (trainer && trainer.userId && trainer.userId !== user.id) {
        error(res, 409, "That trainer profile is already linked to another account");
        return;
      }
    }
    if (!trainer) {
      trainer = await prisma.trainer.findFirst({
        where: { userId: null, email: { equals: user.email, mode: "insensitive" } },
      });
      if (trainer) {
        const updates: Record<string, unknown> = { userId: user.id };
        if (!trainer.name || trainer.name.trim() === "") updates.name = user.fullName;
        if (!trainer.phone) updates.phone = user.phone;
        if (!trainer.profession) updates.profession = user.profession;
        if (!trainer.itsId) updates.itsId = user.itsId;
        trainer = await prisma.trainer.update({ where: { id: trainer.id }, data: updates });
      }
    }
    if (!trainer) {
      trainer = await prisma.trainer.create({
        data: {
          name: user.fullName,
          email: user.email,
          phone: user.phone,
          profession: user.profession,
          itsId: user.itsId,
          userId: user.id,
        },
      });
    }

    await prisma.user.update({ where: { id: user.id }, data: { status: UserStatus.ACTIVE } });
    await notifySystem([user.id], `Your account has been approved. You can now sign in and start using Trainer Tracker.`, MessageKind.SYSTEM_APPROVED, {
      subject: "Account approved",
      emailTo: [user.email],
    });

    res.json({
      ok: true,
      user: serializeUser({ ...user, status: UserStatus.ACTIVE }),
      trainerId: trainer.id,
      trainerName: trainer.name,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 400, err.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (err instanceof HttpError || (err as { code?: string }).code === "P2002") {
      error(res, 409, "Could not link this registration to a trainer profile (possible conflict).");
      return;
    }
    error(res, 500, err instanceof Error ? err.message : "Approval failed");
  }
});

const rejectSchema = z.object({ reason: z.string().trim().max(400).optional().default("") });

adminRouter.post("/registrations/:id/reject", async (req, res) => {
  try {
    const body = rejectSchema.parse(req.body ?? {});
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.role !== Role.TRAINER) {
      error(res, 404, "Registration not found");
      return;
    }
    await prisma.user.update({ where: { id: user.id }, data: { status: UserStatus.REJECTED } });
    await notifySystem(
      [user.id],
      `Your trainer registration was not approved.${body.reason ? ` Reason: ${body.reason}` : ""} Please contact an admin.`,
      MessageKind.SYSTEM_REJECTED,
      { subject: "Registration update", emailTo: [user.email] },
    );
    res.json({ ok: true, user: serializeUser({ ...user, status: UserStatus.REJECTED }) });
  } catch (err) {
    error(res, 500, err instanceof Error ? err.message : "Reject failed");
  }
});

// ---- Trainer management ---------------------------------------------------

adminRouter.get("/trainers", async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const hasAccount = req.query.hasAccount === "true" ? true : req.query.hasAccount === "false" ? false : undefined;

  const trainers = await prisma.trainer.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { profession: { contains: q, mode: "insensitive" } },
              { surveyExpertise: { contains: q, mode: "insensitive" } },
              { itsId: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(hasAccount !== undefined ? { userId: hasAccount ? { not: null } : null } : {}),
    },
    include: { user: { select: { id: true, email: true, status: true, role: true } } },
    orderBy: { name: "asc" },
  });

  // availability hints per trainer for the current year (used by the assign dialog)
  const year = currentYear();
  const availRows = await prisma.availability.findMany({
    where: { year, trainerId: { in: trainers.map((t) => t.id) } },
  });
  const availByTrainer: Record<string, Record<string, string>> = {};
  for (const t of trainers) {
    availByTrainer[t.id] = {};
    for (const r of availRows.filter((r) => r.trainerId === t.id)) availByTrainer[t.id][r.month] = r.status;
  }

  res.json({
    trainers: trainers.map((t) => ({
      ...serializeTrainer(t, { admin: true }),
      availability: availByTrainer[t.id] ?? {},
    })),
  });
});

const createTrainerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().max(200).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  profession: z.string().trim().max(120).optional().default(""),
  itsId: z.string().trim().max(40).optional().default(""),
});

adminRouter.post("/trainers", async (req, res) => {
  try {
    const body = createTrainerSchema.parse(req.body);
    const trainer = await prisma.trainer.create({
      data: {
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        profession: body.profession || null,
        itsId: body.itsId || null,
      },
    });
    res.status(201).json({ trainer: serializeTrainer(trainer, { admin: true }) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 400, err.issues[0]?.message ?? "Invalid input");
      return;
    }
    error(res, 409, "A trainer with that email may already exist");
  }
});

const trainerFieldsSchema = z.object({
  itsId: z.string().trim().max(40).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().toLowerCase().max(200).optional(),
  profession: z.string().trim().max(120).nullable().optional(),
  surveyExpertise: z.string().trim().max(4000).nullable().optional(),
  surveyTopics: z.string().trim().max(4000).nullable().optional(),
  surveyFormat: z.string().trim().max(400).nullable().optional(),
  surveyDayAvailability: z.string().trim().max(200).nullable().optional(),
  finalTopics: z.string().trim().max(4000).nullable().optional(),
  preferredFormat: z.string().trim().max(40).nullable().optional(),
  preferredDays: z.string().trim().max(40).nullable().optional(),
  preferredTime: z.string().trim().max(40).nullable().optional(),
  maxSessions: z.number().int().min(0).max(99).nullable().optional(),
  minNotice: z.string().trim().max(40).nullable().optional(),
  languages: z.string().trim().max(500).nullable().optional(),
  constraints: z.string().trim().max(4000).nullable().optional(),
  meetingStatus: z.enum(["", ...MEETING_STATUSES] as [string, ...string[]]).optional(),
  meetingDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
  willingness: z.string().trim().max(40).nullable().optional(),
  freeTraining: z.string().trim().max(40).nullable().optional(),
  fee: z.string().trim().max(500).nullable().optional(),
  followUp: z.string().trim().max(1000).nullable().optional(),
});

adminRouter.get("/trainers/:id", async (req, res) => {
  const trainer = await prisma.trainer.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, email: true, status: true, role: true } } },
  });
  if (!trainer) {
    error(res, 404, "Trainer not found");
    return;
  }
  res.json({ trainer: serializeTrainer(trainer, { admin: true }) });
});

adminRouter.put("/trainers/:id", async (req, res) => {
  try {
    const patch = trainerFieldsSchema.parse(req.body);
    const existing = await prisma.trainer.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      error(res, 404, "Trainer not found");
      return;
    }
    const data: Record<string, unknown> = {};
    const allowed = new Set<string>([...OPEN_TEXT_FIELDS, "maxSessions", "meetingDate", "meetingStatus"]);
    for (const [k, v] of Object.entries(patch)) {
      if (!allowed.has(k)) continue;
      if (k === "meetingDate") {
        data[k] = v === "" || v === null ? null : new Date(`${v}T00:00:00`);
      } else if (k === "meetingStatus") {
        data[k] = v; // validated to enum
      } else if (v === "" || v === null) {
        data[k] = null;
      } else {
        data[k] = v;
      }
    }
    if (Object.keys(data).length === 0) {
      error(res, 400, "No fields supplied");
      return;
    }
    const updated = await prisma.trainer.update({
      where: { id: req.params.id },
      data,
      include: { user: { select: { id: true, email: true, status: true, role: true } } },
    });
    res.json({ trainer: serializeTrainer(updated, { admin: true }) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 400, err.issues[0]?.message ?? "Invalid input");
      return;
    }
    error(res, 500, err instanceof Error ? err.message : "Update failed");
  }
});

const adminAvailSchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  entries: z.array(
    z.object({
      month: z.enum(MONTHS as [string, ...string[]]),
      status: z.enum(["", ...AVAIL_VALUES] as [string, ...string[]]),
    }),
  ),
});

adminRouter.get("/trainers/:id/availability", async (req, res) => {
  const trainer = await prisma.trainer.findUnique({ where: { id: req.params.id } });
  if (!trainer) {
    error(res, 404, "Trainer not found");
    return;
  }
  const year = Number(req.query.year) || currentYear();
  res.json({ year, entries: await getAvailabilityYear(trainer.id, year) });
});

adminRouter.put("/trainers/:id/availability", async (req, res) => {
  try {
    const body = adminAvailSchema.parse(req.body);
    const trainer = await prisma.trainer.findUnique({ where: { id: req.params.id } });
    if (!trainer) {
      error(res, 404, "Trainer not found");
      return;
    }
    const year = body.year ?? currentYear();
    await putAvailabilityYear(trainer.id, year, body.entries);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 400, err.issues[0]?.message ?? "Invalid input");
      return;
    }
    error(res, 500, err instanceof Error ? err.message : "Save failed");
  }
});

// ---- User account management ----------------------------------------------

adminRouter.post("/users/:id/reset-password", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    error(res, 404, "Account not found");
    return;
  }
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 11);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: true } });
  const body = `An admin has reset your password. Your temporary password is: ${tempPassword}   (You will be asked to set a new one on your next sign-in.)`;
  await notifySystem([user.id], body, MessageKind.SYSTEM_RESET, {
    subject: "Password reset",
    emailTo: [user.email],
  });
  res.json({ ok: true, tempPassword });
});

function generateTempPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

adminRouter.post("/users/:id/disable", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    error(res, 404, "Account not found");
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { status: UserStatus.DISABLED } });
  res.json({ ok: true });
});

adminRouter.post("/users/:id/enable", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    error(res, 404, "Account not found");
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { status: UserStatus.ACTIVE } });
  res.json({ ok: true });
});