import { MessageKind, SessionFormat, SessionStatus } from "@prisma/client";
import { DateTime } from "luxon";

import { prisma } from "../db";
import { HttpError } from "./http";
import { appTz, fmt } from "./time";
import { EMAIL_NOT_CONFIGURED_MESSAGE, postMessage, sendEmail, ensureThread } from "./notify";

export const MAX_SERIES_OCCURRENCES = 100;

export type SeriesInput = {
  frequency: "WEEKLY" | "MONTHLY";
  interval: number;
  until: string; // YYYY-MM-DD, inclusive, in app tz
};

export type SessionInput = {
  title: string;
  topic?: string | null;
  startsAt: string; // ISO datetime
  durationMinutes: number;
  format: SessionFormat;
  venue?: string | null;
  link?: string | null;
  notes?: string | null;
  trainerIds: string[];
  series?: SeriesInput;
};

/** Compute the list of occurrence datetimes for a series, in app tz. */
export function buildOccurrences(base: DateTime, series: SeriesInput): DateTime[] {
  const until = DateTime.fromISO(series.until, { zone: appTz() }).endOf("day");
  const out: DateTime[] = [];
  let dt = base;
  let guard = 0;
  while (dt <= until && out.length < MAX_SERIES_OCCURRENCES && guard < 10_000) {
    guard += 1;
    out.push(dt);
    if (series.frequency === "WEEKLY") {
      dt = dt.plus({ weeks: series.interval });
    } else {
      const month = dt.month + series.interval;
      const ref = DateTime.fromObject({ year: dt.year, month: 1, day: 1 }, { zone: appTz() }).plus({ months: month - 1 });
      const day = Math.min(dt.day, ref.daysInMonth ?? dt.day);
      dt = ref.set({ day });
    }
  }
  return out;
}

export async function createSession(input: SessionInput, adminId: string): Promise<{ count: number; emailWarning?: string }> {
  const base = DateTime.fromISO(input.startsAt, { zone: appTz() });
  if (!base.isValid) throw new HttpError(400, `Invalid start time: "${input.startsAt}"`);

  const occurrences = input.series ? buildOccurrences(base, input.series) : [base];
  if (occurrences.length === 0) throw new HttpError(400, "Series produced no occurrences");

  const trainers = await prisma.trainer.findMany({
    where: { id: { in: input.trainerIds } },
    include: { user: { select: { id: true, email: true, status: true } } },
  });
  const byId = new Map(trainers.map((t) => [t.id, t]));
  let emailWarning: string | undefined;

  // One series row (if recurring) shared by all occurrences.
  let seriesId: string | null = null;
  if (input.series) {
    const until = DateTime.fromISO(input.series.until, { zone: appTz() });
    const series = await prisma.sessionSeries.create({
      data: {
        frequency: input.series.frequency,
        interval: input.series.interval,
        until: new Date(until.toISODate() + "T00:00:00"),
        dayOfWeek: input.series.frequency === "WEEKLY" ? base.weekday : null,
        dayOfMonth: input.series.frequency === "MONTHLY" ? base.day : null,
        startAt: base.toJSDate(),
        createdById: adminId,
      },
    });
    seriesId = series.id;
  }

  for (const occurrence of occurrences) {
    const session = await prisma.session.create({
      data: {
        title: input.title,
        topic: input.topic || null,
        startsAt: occurrence.toJSDate(),
        durationMinutes: input.durationMinutes,
        format: input.format,
        venue: input.venue || null,
        link: input.link || null,
        notes: input.notes || null,
        status: SessionStatus.SCHEDULED,
        seriesId,
        createdById: adminId,
        trainers: {
          create: input.trainerIds.map((trainerId) => ({
            trainerId,
            assignedById: adminId,
          })),
        },
      },
    });

    const participantIds = new Set<string>([adminId]);
    const emails: string[] = [];
    for (const tid of input.trainerIds) {
      const trainer = byId.get(tid);
      if (trainer?.user && trainer.user.status === "ACTIVE") {
        participantIds.add(trainer.user.id);
        emails.push(trainer.user.email);
      }
    }
    const userIds = [...participantIds];

    const thread = await ensureThread(userIds, { subject: `Session: ${session.title}`, sessionId: session.id });

    const when = fmt(session.startsAt, "ccc, LLL d, h:mm a");
    const trainerNames = input.trainerIds.map((tid) => byId.get(tid)?.name).filter(Boolean).join(", ");
    let body = `Session "${session.title}" scheduled for ${when} in ${appTz()}. Assigned: ${trainerNames || "—"}.`;
    if (input.venue) body += ` Venue/venue: ${input.venue}.`;
    if (input.link) body += ` Link: ${input.link}.`;
    body += " Please accept or decline in My Sessions.";

    await postMessage(thread.id, { kind: MessageKind.SYSTEM_ASSIGNED, body });
    if (emails.length > 0) {
      const result = await sendEmail(`New session assignment: ${session.title}`, body, emails);
      if (!result.sent && !emailWarning) {
        emailWarning = result.reason === "not_configured" ? EMAIL_NOT_CONFIGURED_MESSAGE : "One or more assignment emails could not be sent — check the mail server settings.";
      }
    }
  }

  return { count: occurrences.length, emailWarning };
}