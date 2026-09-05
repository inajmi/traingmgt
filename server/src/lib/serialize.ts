import { AssignmentStatus, Session, SessionTrainer, Trainer, User } from "@prisma/client";

import { toDateString } from "./time";

type TrainerWithUser = Trainer & { user?: Pick<User, "id" | "email" | "status" | "role"> | null };

export function serializeTrainer(t: TrainerWithUser, opts: { admin: boolean }) {
  const out: Record<string, unknown> = {
    id: t.id,
    itsId: t.itsId ?? "",
    name: t.name,
    phone: t.phone ?? "",
    email: t.email ?? "",
    profession: typeof t.profession === "number" ? String(t.profession) : (t.profession ?? ""),
    surveyExpertise: t.surveyExpertise ?? "",
    surveyTopics: t.surveyTopics ?? "",
    surveyFormat: t.surveyFormat ?? "",
    surveyDayAvailability: t.surveyDayAvailability ?? "",
    finalTopics: t.finalTopics ?? "",
    preferredFormat: t.preferredFormat ?? "",
    preferredDays: t.preferredDays ?? "",
    preferredTime: t.preferredTime ?? "",
    maxSessions: t.maxSessions ?? null,
    minNotice: t.minNotice ?? "",
    languages: t.languages ?? "",
    constraints: t.constraints ?? "",
    meetingStatus: t.meetingStatus ?? "",
    meetingDate: t.meetingDate ? toDateString(t.meetingDate) : "",
  };
  if (opts.admin) {
    out.willingness = t.willingness ?? "";
    out.freeTraining = t.freeTraining ?? "";
    out.fee = t.fee ?? "";
    out.followUp = t.followUp ?? "";
    out.userId = t.userId ?? null;
    out.account = t.user
      ? { id: t.user.id, email: t.user.email, status: t.user.status, role: t.user.role }
      : null;
  }
  return out;
}

type SessionWithTrainers = Session & {
  trainers?: (SessionTrainer & { trainer: TrainerWithUser })[];
  creator?: Pick<User, "id" | "fullName"> | null;
};

export function serializeSession(s: SessionWithTrainers, viewer: { role: "ADMIN" | "TRAINER"; userId: string }) {
  const assignees = (s.trainers ?? []) as (SessionTrainer & { trainer: TrainerWithUser })[];
  const base = {
    id: s.id,
    title: s.title,
    topic: s.topic ?? "",
    startsAt: s.startsAt.toISOString(),
    durationMinutes: s.durationMinutes,
    format: s.format,
    venue: s.venue ?? "",
    link: s.link ?? "",
    notes: s.notes ?? "",
    status: s.status,
    seriesId: s.seriesId ?? null,
    createdAt: s.createdAt.toISOString(),
  };

  if (viewer.role === "ADMIN") {
    return {
      ...base,
      createdBy: s.creator ? { id: s.creator.id, fullName: s.creator.fullName } : null,
      assignments: assignees.map((a) => ({
        status: a.status,
        respondedAt: a.respondedAt ? a.respondedAt.toISOString() : null,
        trainer: serializeTrainer(a.trainer, { admin: true }),
      })),
    };
  }

  const my = assignees.find((a) => a.trainer.userId === viewer.userId);
  return {
    ...base,
    trainerNames: assignees.map((a) => a.trainer.name),
    myStatus: (my?.status as AssignmentStatus | undefined) ?? null,
  };
}

export function monthStatus(availability: Record<string, string> | undefined, month: string): string {
  return availability?.[month] ?? "";
}