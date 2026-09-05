import { AssignmentStatus, MessageKind, SessionFormat, SessionStatus } from "@prisma/client";
import express from "express";
import { z } from "zod";

import { prisma } from "../db";
import { error, HttpError } from "../lib/http";
import { ensureThread, notifySystem, postMessage, sendEmail, sessionParticipants } from "../lib/notify";
import { serializeSession } from "../lib/serialize";
import { createSession } from "../lib/sessions";
import { appTz, fmt } from "../lib/time";
import { requireActive, requireAdmin, requireAuth } from "../middleware/auth";
import { DateTime } from "luxon";

export const sessionsRouter = express.Router();

const sessionInclude = {
  trainers: { include: { trainer: { include: { user: { select: { id: true, email: true, status: true, role: true } } } } } },
  creator: { select: { id: true, fullName: true } },
} as const;

async function loadSession(id: string) {
  return prisma.session.findUnique({ where: { id }, include: sessionInclude });
}

export type FullSession = NonNullable<Awaited<ReturnType<typeof loadSession>>>;

async function getThread(session: FullSession, userIds: string[]) {
  return ensureThread(userIds, { subject: `Session: ${session.title}`, sessionId: session.id });
}

// ---- List / calendar ------------------------------------------------------

sessionsRouter.get("/", requireAuth, requireActive, async (req, res) => {
  const role = req.user!.role;
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const defaultEnd = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);

  let start = defaultStart;
  let end = defaultEnd;
  if (req.query.start) {
    const d = DateTime.fromISO(String(req.query.start));
    if (d.isValid) start = d.toJSDate();
  }
  if (req.query.end) {
    const d = DateTime.fromISO(String(req.query.end));
    if (d.isValid) end = d.toJSDate();
  }

  const sessions = await prisma.session.findMany({
    where: { startsAt: { gte: start, lte: end } },
    include: sessionInclude,
    orderBy: { startsAt: "asc" },
  });

  res.json({
    sessions: sessions.map((s) => serializeSession(s as FullSession, { role, userId: req.user!.id })),
  });
});

sessionsRouter.get("/:id", requireAuth, requireActive, async (req, res) => {
  const session = await loadSession(req.params.id);
  if (!session) {
    error(res, 404, "Session not found");
    return;
  }
  res.json({ session: serializeSession(session as FullSession, { role: req.user!.role, userId: req.user!.id }) });
});

// ---- Create (admin) -------------------------------------------------------

const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  topic: z.string().trim().max(2000).nullable().optional(),
  startsAt: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(600),
  format: z.enum(["IN_PERSON", "ONLINE", "HYBRID"]),
  venue: z.string().trim().max(300).nullable().optional(),
  link: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  trainerIds: z.array(z.string()).max(100).default([]),
  series: z
    .object({
      frequency: z.enum(["WEEKLY", "MONTHLY"]),
      interval: z.number().int().min(1).max(12),
      until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "until must be YYYY-MM-DD"),
    })
    .optional(),
});

sessionsRouter.post("/", requireAuth, requireActive, requireAdmin, async (req, res) => {
  try {
    const body = createSchema.parse(req.body);
    const { count } = await createSession(body, req.user!.id);
    res.status(201).json({ ok: true, created: count });
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 400, err.issues[0]?.message ?? "Invalid input");
      return;
    }
    error(res, 500, err instanceof Error ? err.message : "Create failed");
  }
});

// ---- Add assignees (admin) ------------------------------------------------

const addTrainersSchema = z.object({ trainerIds: z.array(z.string()).min(1).max(100) });

sessionsRouter.post("/:id/trainers", requireAuth, requireActive, requireAdmin, async (req, res) => {
  try {
    const body = addTrainersSchema.parse(req.body);
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!session) {
      error(res, 404, "Session not found");
      return;
    }
    if (session.status === SessionStatus.CANCELLED) {
      error(res, 400, "Session is cancelled");
      return;
    }

    const existing = await prisma.sessionTrainer.findMany({
      where: { sessionId: session.id },
      select: { trainerId: true },
    });
    const have = new Set(existing.map((e) => e.trainerId));
    const newOnes = body.trainerIds.filter((id) => !have.has(id));
    const trainers = await prisma.trainer.findMany({
      where: { id: { in: newOnes } },
      include: { user: { select: { id: true, email: true, status: true } } },
    });
    if (newOnes.length > 0) {
      await prisma.sessionTrainer.createMany({
        data: newOnes.map((trainerId) => ({ sessionId: session.id, trainerId, assignedById: req.user!.id })),
        skipDuplicates: true,
      });
    }

    const full = await loadSession(session.id);
    if (!full) {
      error(res, 404, "Session not found");
      return;
    }
    const { userIds, emails } = await sessionParticipants(full);
    const thread = await getThread(full, userIds);
    for (const t of trainers) {
      const when = fmt(session.startsAt, "ccc, LLL d, h:mm a");
      const bodyText = `You have been assigned to session "${session.title}" (${when}, ${session.format}${session.venue ? `, ${session.venue}` : ""}). Please accept or decline in My Sessions.`;
      await postMessage(thread.id, { kind: MessageKind.SYSTEM_ASSIGNED, body: bodyText });
      if (t.user?.email) await sendEmail(`New session assignment: ${session.title}`, bodyText, [t.user.email]);
    }
    void emails;

    const updated = await loadSession(session.id);
    res.json({ session: serializeSession(updated as FullSession, { role: "ADMIN", userId: req.user!.id }) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 400, err.issues[0]?.message ?? "Invalid input");
      return;
    }
    error(res, 500, err instanceof Error ? err.message : "Assignment failed");
  }
});

// ---- Accept / decline (trainer) -------------------------------------------

const respondSchema = z.object({ accepted: z.boolean() });

sessionsRouter.post("/:id/respond", requireAuth, requireActive, async (req, res) => {
  try {
    const body = respondSchema.parse(req.body);
    const session = await loadSession(req.params.id);
    if (!session) {
      error(res, 404, "Session not found");
      return;
    }
    const assignment = session.trainers.find((st) => st.trainer.userId === req.user!.id);
    if (!assignment) {
      error(res, 403, "You are not assigned to this session");
      return;
    }
    if (assignment.status !== AssignmentStatus.ASSIGNED) {
      error(res, 400, "You have already responded to this session");
      return;
    }
    const next = body.accepted ? AssignmentStatus.ACCEPTED : AssignmentStatus.DECLINED;
    await prisma.sessionTrainer.update({
      where: { sessionId_trainerId: { sessionId: session.id, trainerId: assignment.trainerId } },
      data: { status: next, respondedAt: new Date() },
    });

    const { userIds, emails } = await sessionParticipants(session);
    const thread = await getThread(session, userIds);
    const who = req.user!.fullName;
    const text = body.accepted
      ? `${who} accepted "${session.title}".`
      : `${who} declined "${session.title}". The admin may assign someone else.`;
    await postMessage(thread.id, { kind: body.accepted ? MessageKind.SYSTEM_ACCEPTED : MessageKind.SYSTEM_DECLINED, body: text });
    await sendEmail(
      body.accepted ? `Trainer accepted: ${session.title}` : `Trainer declined: ${session.title}`,
      text,
      emails,
    );

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 400, err.issues[0]?.message ?? "Invalid input");
      return;
    }
    res.status(err instanceof HttpError ? err.status : 500).json({ error: err instanceof Error ? err.message : "Respond failed" });
  }
});

// ---- Update / cancel (admin) ----------------------------------------------

const updateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  topic: z.string().trim().max(2000).nullable().optional(),
  startsAt: z.string().optional(),
  durationMinutes: z.number().int().min(15).max(600).optional(),
  format: z.enum(["IN_PERSON", "ONLINE", "HYBRID"]).optional(),
  venue: z.string().trim().max(300).nullable().optional(),
  link: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

sessionsRouter.patch("/:id", requireAuth, requireActive, requireAdmin, async (req, res) => {
  try {
    const body = updateSchema.parse(req.body);
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!session) {
      error(res, 404, "Session not found");
      return;
    }
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      data[k] = k === "startsAt" ? DateTime.fromISO(String(v), { zone: appTz() }).toJSDate() : v;
    }
    const updated = await prisma.session.update({ where: { id: session.id }, data });
    const withP = await loadSession(updated.id);
    res.json({ session: serializeSession(withP as FullSession, { role: "ADMIN", userId: req.user!.id }) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 400, err.issues[0]?.message ?? "Invalid input");
      return;
    }
    error(res, 500, err instanceof Error ? err.message : "Update failed");
  }
});

sessionsRouter.post("/:id/cancel", requireAuth, requireActive, requireAdmin, async (req, res) => {
  const session = await prisma.session.findUnique({ where: { id: req.params.id } });
  if (!session) {
    error(res, 404, "Session not found");
    return;
  }
  await prisma.session.update({ where: { id: session.id }, data: { status: SessionStatus.CANCELLED } });

  const full = await loadSession(session.id);
  if (!full) {
    error(res, 404, "Session not found");
    return;
  }
  const { userIds, emails } = await sessionParticipants(full);
  const thread = await getThread(full, userIds);
  const text = `Session "${session.title}" was cancelled by an admin.`;
  await postMessage(thread.id, { kind: MessageKind.SYSTEM_CANCELLED, body: text });
  await sendEmail(`Session cancelled: ${session.title}`, text, emails);

  res.json({ ok: true });
});