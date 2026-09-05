import express from "express";
import { z } from "zod";

import { prisma } from "../db";
import { error } from "../lib/http";
import { ensureThread, postMessage } from "../lib/notify";
import { requireActive, requireAuth } from "../middleware/auth";

export const messagingRouter = express.Router();

messagingRouter.use(requireAuth, requireActive);

export type ThreadListItem = {
  id: string;
  subject: string | null;
  sessionId: string | null;
  others: { id: string; fullName: string; role: string }[];
  lastMessage: { body: string; kind: string; createdAt: string } | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

/** Full thread listing for a user, including per-thread unread counts. */
export async function listThreadsFor(userId: string): Promise<ThreadListItem[]> {
  const mine = await prisma.threadParticipant.findMany({
    where: { userId },
    include: {
      thread: {
        include: {
          participants: { include: { user: { select: { id: true, fullName: true, role: true } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { thread: { createdAt: "desc" } },
  });

  const out: ThreadListItem[] = [];
  for (const p of mine) {
    const t = p.thread;
    const last = t.messages[0] ?? null;
    const unread = await prisma.message.count({
      where: {
        threadId: t.id,
        senderUserId: { not: userId },
        createdAt: p.lastReadAt ? { gt: p.lastReadAt } : undefined,
      },
    });
    out.push({
      id: t.id,
      subject: t.subject,
      sessionId: t.sessionId,
      others: t.participants
        .filter((x) => x.userId !== userId)
        .map((x) => ({ id: x.user.id, fullName: x.user.fullName, role: x.user.role })),
      lastMessage: last ? { body: last.body, kind: last.kind, createdAt: last.createdAt.toISOString() } : null,
      lastMessageAt: last ? last.createdAt.toISOString() : null,
      unreadCount: unread,
    });
  }
  return out;
}

messagingRouter.get("/threads", async (req, res) => {
  res.json({ threads: await listThreadsFor(req.user!.id) });
});

messagingRouter.get("/people", async (req, res) => {
  const me = req.user!;
  const isAdmin = me.role === "ADMIN";
  const people = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, fullName: true, role: true, email: true },
    orderBy: { fullName: "asc" },
  });
  res.json({
    people: people
      .filter((p) => p.id !== me.id)
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        role: p.role === "ADMIN" ? "admin" : "trainer",
        ...(isAdmin ? { email: p.email } : {}),
      })),
  });
});

const createThreadSchema = z.object({
  subject: z.string().trim().max(200).optional(),
  participantIds: z.array(z.string()).min(1).max(50),
  sessionId: z.string().optional(),
});

messagingRouter.post("/threads", async (req, res) => {
  try {
    const body = createThreadSchema.parse(req.body);
    const me = req.user!.id;
    const ids = [...new Set([me, ...body.participantIds])];
    if (ids.length < 2) {
      error(res, 400, "A thread needs at least one other participant");
      return;
    }
    const thread = await ensureThread(ids, { subject: body.subject, sessionId: body.sessionId });
    res.status(201).json({ thread: { id: thread.id, subject: thread.subject, sessionId: thread.sessionId } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 400, err.issues[0]?.message ?? "Invalid input");
      return;
    }
    error(res, 500, err instanceof Error ? err.message : "Create failed");
  }
});

async function assertParticipant(threadId: string, userId: string): Promise<boolean> {
  const p = await prisma.threadParticipant.findUnique({
    where: { threadId_userId: { threadId, userId } },
  });
  return !!p;
}

messagingRouter.get("/threads/:id/messages", async (req, res) => {
  if (!(await assertParticipant(req.params.id, req.user!.id))) {
    error(res, 403, "You are not part of this thread");
    return;
  }
  const messages = await prisma.message.findMany({
    where: { threadId: req.params.id },
    orderBy: { createdAt: "asc" },
    take: 500,
    include: { sender: { select: { id: true, fullName: true, role: true } } },
  });
  res.json({
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      kind: m.kind,
      createdAt: m.createdAt.toISOString(),
      senderId: m.senderUserId,
      senderName: m.sender?.fullName ?? null,
      senderRole: m.sender?.role ?? null,
    })),
  });
});

const sendSchema = z.object({ body: z.string().trim().min(1).max(4000) });

messagingRouter.post("/threads/:id/messages", async (req, res) => {
  try {
    const body = sendSchema.parse(req.body);
    if (!(await assertParticipant(req.params.id, req.user!.id))) {
      error(res, 403, "You are not part of this thread");
      return;
    }
    await postMessage(req.params.id, { senderUserId: req.user!.id, body: body.body });
    // Update own read pointer so your sent message is not 'unread' to you.
    await prisma.threadParticipant.updateMany({
      where: { threadId: req.params.id, userId: req.user!.id },
      data: { lastReadAt: new Date() },
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 400, err.issues[0]?.message ?? "Invalid input");
      return;
    }
    error(res, 500, err instanceof Error ? err.message : "Send failed");
  }
});

messagingRouter.post("/threads/:id/read", async (req, res) => {
  const updated = await prisma.threadParticipant.updateMany({
    where: { threadId: req.params.id, userId: req.user!.id },
    data: { lastReadAt: new Date() },
  });
  res.json({ ok: true, updated: updated.count });
});