import { MessageKind } from "@prisma/client";

import { prisma } from "../db";
import { ensureThread, postMessage, sendEmail, sessionParticipants } from "./notify";
import { appTz, fmt } from "./time";

export async function runReminderSweep(): Promise<number> {
  const now = new Date();
  const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const due = await prisma.session.findMany({
    where: { status: "SCHEDULED", remindedAt: null, startsAt: { gte: now, lte: later } },
  });

  let sent = 0;
  for (const session of due) {
    const { userIds, emails } = await sessionParticipants(session);
    if (userIds.length > 0) {
      const thread = await ensureThread(userIds, { subject: `Session: ${session.title}`, sessionId: session.id });
      const when = fmt(session.startsAt, "ccc, LLL d, h:mm a") ?? "";
      await postMessage(thread.id, {
        kind: MessageKind.SYSTEM_REMINDER,
        body: `Reminder: "${session.title}" is scheduled for ${when} (${
          userIds.length > 1 ? `${userIds.length} participant(s)` : "you"
        }). Check your sessions for details.`,
      });
      await sendEmail(`Upcoming session: ${session.title}`, `Reminder: ${session.title} is scheduled for ${when} in ${appTz()}.`, emails);
      sent += 1;
    }
    await prisma.session.update({ where: { id: session.id }, data: { remindedAt: now } });
  }
  return sent;
}

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;
  const intervalMs = 60 * 60 * 1000;
  void runReminderSweep();
  setInterval(() => {
    runReminderSweep().catch((err) => console.error("[scheduler] sweep failed:", (err as Error).message));
  }, intervalMs);
}