export type Role = "admin" | "trainer";

export type PermissionKey =
  | "SETTINGS_MANAGE"
  | "USERS_MANAGE"
  | "ROLES_MANAGE"
  | "TRAINERS_MANAGE"
  | "SESSIONS_MANAGE"
  | "REGISTRATIONS_MANAGE";

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: string;
  mustChangePassword: boolean;
  permissions?: PermissionKey[];
};

export type AccessRoleSummary = { id: string; name: string };

export type StaffUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: string;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  accessRole: AccessRoleSummary | null;
};

export type PermissionDef = { key: PermissionKey; label: string; description: string };

export type AccessRoleFull = {
  id: string;
  name: string;
  isSystem: boolean;
  userCount: number;
  permissions: PermissionKey[];
};

export type SystemSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  smtpPassSet: boolean;
  sessionTimeoutMinutes: number;
};

export type TrainerProfile = {
  id: string;
  itsId: string;
  name: string;
  phone: string;
  email: string;
  profession: string;
  surveyExpertise: string;
  surveyTopics: string;
  surveyFormat: string;
  surveyDayAvailability: string;
  finalTopics: string;
  preferredFormat: string;
  preferredDays: string;
  preferredTime: string;
  maxSessions: number | null;
  minNotice: string;
  languages: string;
  constraints: string;
  meetingStatus: string;
  meetingDate: string;
  // admin only:
  willingness?: string;
  freeTraining?: string;
  fee?: string;
  followUp?: string;
  account?: { id: string; email: string; status: string; role: string } | null;
  availability?: Record<string, string>;
};

export type AvailabilityEntry = { month: string; status: string };

export type SessionFormat = "IN_PERSON" | "ONLINE" | "HYBRID";
export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";
export type AssignmentStatus = "ASSIGNED" | "ACCEPTED" | "DECLINED";

export type SessionAdmin = {
  id: string;
  title: string;
  topic: string;
  startsAt: string;
  durationMinutes: number;
  format: SessionFormat;
  venue: string;
  link: string;
  notes: string;
  status: SessionStatus;
  seriesId: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string } | null;
  assignments: { status: AssignmentStatus; respondedAt: string | null; trainer: TrainerProfile }[];
};

export type SessionMine = {
  id: string;
  title: string;
  topic: string;
  startsAt: string;
  durationMinutes: number;
  format: SessionFormat;
  venue: string;
  link: string;
  notes: string;
  status: SessionStatus;
  seriesId: string | null;
  createdAt: string;
  trainerNames: string[];
  myStatus: AssignmentStatus | null;
};

export type ThreadListItem = {
  id: string;
  subject: string | null;
  sessionId: string | null;
  others: { id: string; fullName: string; role: Role }[];
  lastMessage: { body: string; kind: string; createdAt: string } | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type MessageItem = {
  id: string;
  body: string;
  kind: string;
  createdAt: string;
  senderId: string | null;
  senderName: string | null;
  senderRole: Role | null;
};

export type Person = { id: string; fullName: string; role: Role; email?: string };

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const AVAIL_STATUSES = ["Available", "Limited", "Holiday", "Unavailable"];
export const MEETING_STATUSES = ["Not Started", "Scheduled", "Completed", "No Response"];

export const AVAIL_COLORS: Record<string, string> = {
  Available: "#2f6f4f",
  Limited: "#b8862f",
  Holiday: "#5b6b8c",
  Unavailable: "#a8433a",
};

export const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  "Not Started": { bg: "#eee9dd", fg: "#6b6355" },
  Scheduled: { bg: "#e4e9f2", fg: "#3d5680" },
  Completed: { bg: "#e0ecdf", fg: "#33623f" },
  "No Response": { bg: "#f2e3e0", fg: "#8a4136" },
};

export const ASSIGN_STYLE: Record<AssignmentStatus, { bg: string; fg: string }> = {
  ASSIGNED: { bg: "#eee9dd", fg: "#6b6355" },
  ACCEPTED: { bg: "#e0ecdf", fg: "#33623f" },
  DECLINED: { bg: "#f2e3e0", fg: "#8a4136" },
};