import { MessageKind, Prisma, Session } from "@prisma/client";

import { prisma } from "../db";
import { getSmtpTransport } from "./settings";

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

export const EMAIL_NOT_CONFIGURED_MESSAGE = "Email was not sent — no mail server is configured in System settings.";

/** Send a system message to recipient users (inbox + optional email when SMTP configured).
 *  Returns an `emailWarning` when an email was requested but skipped/failed, so callers
 *  can surface it to the admin who triggered the action instead of failing silently. */
export async function notifySystem(
  recipientUserIds: string[],
  body: string,
  kind: MessageKind,
  opts: { subject?: string; sessionId?: string | null; emailTo?: string[] } = {},
): Promise<{ emailWarning?: string }> {
  const thread = await ensureThread(recipientUserIds, {
    subject: opts.subject,
    sessionId: opts.sessionId ?? null,
  });
  await postMessage(thread.id, { body, kind });
  if (opts.emailTo && opts.emailTo.length > 0) {
    const result = await sendEmail(kindTitle(kind), body, opts.emailTo);
    if (!result.sent) {
      return { emailWarning: result.reason === "not_configured" ? EMAIL_NOT_CONFIGURED_MESSAGE : "Email could not be sent — check the mail server settings." };
    }
  }
  return {};
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

export type EmailResult = { sent: boolean; reason?: "not_configured" | "error" };

/** Optional SMTP channel, configured via the admin Settings page. Never throws — callers
 *  that care whether the email actually went out should check the returned result. */
export async function sendEmail(subject: string, text: string, to: string[]): Promise<EmailResult> {
  if (to.length === 0) return { sent: false, reason: "not_configured" };
  try {
    const mailer = await getSmtpTransport();
    if (!mailer) return { sent: false, reason: "not_configured" };
    await mailer.transport.sendMail({ from: mailer.from, to: to.join(","), subject, text });
    return { sent: true };
  } catch (err) {
    console.error("[smtp] send failed:", (err as Error).message);
    return { sent: false, reason: "error" };
  }
}