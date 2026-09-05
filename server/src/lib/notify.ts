import { MessageKind, Prisma, Session } from "@prisma/client";
import { createTransport } from "nodemailer";

import { prisma } from "../db";
import { config } from "../env";

type ThreadWithParticipants = Prisma.ThreadGetPayload<{
  include: { participants: { select: { userId: true } } };
}>;

async function ensureParticipants(thread: { id: string }, userIds: string[]) {
  const existing = await prisma.threadParticipant.findMany({
    where: { threadId: thread.id, userId: { in: userIds } },
    select: { userId: true },
  });
  const have = new Set(existing.map((e) => e.userId));
  const missing = userIds.filter((id) => !have.has(id));
  if (missing.length === 0) return;
  await prisma.threadParticipant.createMany({
    data: missing.map((userId) => ({ threadId: thread.id, userId })),
    skipDuplicates: true,
  });
}

/** Find or create a thread. Prefers an existing per-session thread, then an
 *  existing thread with exactly the same participant set (used for 1:1 chats). */
export async function ensureThread(
  participantUserIds: string[],
  opts: { subject?: string; sessionId?: string | null } = {},
): Promise<ThreadWithParticipants> {
  const ids = [...new Set(participantUserIds)].filter(Boolean);
  if (ids.length === 0) throw new Error("Cannot create a thread with no participants");

  if (opts.sessionId) {
    const sessionThread = await prisma.thread.findUnique({
      where: { sessionId: opts.sessionId },
      include: { participants: { select: { userId: true } } },
    });
    if (sessionThread) {
      await ensureParticipants(sessionThread, ids);
      return sessionThread;
    }
  }

  const candidates = await prisma.thread.findMany({
    where: {
      sessionId: opts.sessionId ?? null,
      participants: { every: { userId: { in: ids } } },
    },
    include: { participants: { select: { userId: true } } },
  });
  const exact = candidates.find(
    (t) => t.participants.length === ids.length && ids.every((i) => t.participants.some((p) => p.userId === i)),
  );
  if (exact) return exact;

  return prisma.thread.create({
    data: {
      subject: opts.subject,
      sessionId: opts.sessionId ?? null,
      participants: { create: ids.map((userId) => ({ userId })) },
    },
    include: { participants: { select: { userId: true } } },
  });
}

export async function postMessage(
  threadId: string,
  opts: { senderUserId?: string | null; body: string; kind?: MessageKind },
) {
  return prisma.message.create({
    data: {
      threadId,
      senderUserId: opts.senderUserId ?? null,
      body: opts.body,
      kind: opts.kind ?? MessageKind.USER,
    },
  });
}

export function kindTitle(kind: MessageKind): string {
  switch (kind) {
    case MessageKind.SYSTEM_ASSIGNED:
      return "New session assignment";
    case MessageKind.SYSTEM_ACCEPTED:
      return "Trainer accepted";
    case MessageKind.SYSTEM_DECLINED:
      return "Trainer declined";
    case MessageKind.SYSTEM_APPROVED:
      return "Account approved";
    case MessageKind.SYSTEM_REJECTED:
      return "Registration not approved";
    case MessageKind.SYSTEM_RESET:
      return "Password reset";
    case MessageKind.SYSTEM_REMINDER:
      return "Upcoming session reminder";
    case MessageKind.SYSTEM_SERIES:
      return "Session series created";
    case MessageKind.SYSTEM_CANCELLED:
      return "Session cancelled";
    default:
      return "Message";
  }
}

/** Send a system message to recipient users (inbox + optional email when SMTP configured). */
export async function notifySystem(
  recipientUserIds: string[],
  body: string,
  kind: MessageKind,
  opts: { subject?: string; sessionId?: string | null; emailTo?: string[] } = {},
): Promise<void> {
  const thread = await ensureThread(recipientUserIds, {
    subject: opts.subject,
    sessionId: opts.sessionId ?? null,
  });
  await postMessage(thread.id, { body, kind });
  if (opts.emailTo && opts.emailTo.length > 0) {
    await sendEmail(kindTitle(kind), body, opts.emailTo);
  }
}

/** User ids (with active logins) and their emails attached to a session
 *  (creator + all assigned trainers). */
export async function sessionParticipants(session: Session): Promise<{ userIds: string[]; emails: string[] }> {
  const assignments = await prisma.sessionTrainer.findMany({
    where: { sessionId: session.id, trainer: { userId: { not: null } } },
    include: { trainer: { include: { user: { select: { id: true, email: true, status: true } } } } },
  });
  const userIds = new Set<string>([session.createdById]);
  const emails = new Set<string>();
  for (const a of assignments) {
    const u = a.trainer.user;
    if (u && u.status === "ACTIVE") {
      userIds.add(u.id);
      emails.add(u.email);
    }
  }
  return { userIds: [...userIds], emails: [...emails] };
}

let transporter: ReturnType<typeof createTransport> | null | undefined;

export function smtpConfigured(): boolean {
  return config.smtp.host !== "";
}

/** Optional SMTP channel. Safe no-op when SMTP_* is not configured. */
export async function sendEmail(subject: string, text: string, to: string[]): Promise<void> {
  if (!smtpConfigured() || to.length === 0) return;
  try {
    if (transporter !== null) {
      if (!transporter) {
        transporter = createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.port === 465,
          auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
        });
      }
      await transporter.sendMail({ from: config.smtp.from, to: to.join(","), subject, text });
    }
  } catch (err) {
    console.error("[smtp] send failed:", (err as Error).message);
  }
}