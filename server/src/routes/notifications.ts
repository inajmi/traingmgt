import express from "express";

import { prisma } from "../db";
import { requireActive, requireAuth, requirePasswordFresh } from "../middleware/auth";
import { listThreadsFor } from "./messaging";

export const notificationsRouter = express.Router();

notificationsRouter.use(requireAuth, requireActive, requirePasswordFresh);

notificationsRouter.get("/", async (req, res) => {
  const threads = await listThreadsFor(req.user!.id);
  const unreadTotal = threads.reduce((acc, t) => acc + t.unreadCount, 0);
  const latest = threads
    .filter((t) => t.lastMessageAt)
    .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""))[0] ?? null;
  res.json({ unreadTotal, threads, latest: latest ? { threadId: latest.id, body: latest.lastMessage?.body, subject: latest.subject } : null });
});

notificationsRouter.post("/read-all", async (req, res) => {
  await prisma.threadParticipant.updateMany({
    where: { userId: req.user!.id },
    data: { lastReadAt: new Date() },
  });
  res.json({ ok: true });
});