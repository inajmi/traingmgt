export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const AVAIL_STATUSES = ["Available", "Limited", "Holiday", "Unavailable"];

export const MEETING_STATUSES = ["Not Started", "Scheduled", "Completed", "No Response"];

// Fields trainers may edit on their own profile.
export const TRAINER_EDITABLE = [
  "name",
  "phone",
  "profession",
  "itsId",
  "finalTopics",
  "preferredFormat",
  "preferredDays",
  "preferredTime",
  "maxSessions",
  "minNotice",
  "languages",
  "constraints",
] as const;

// Admin-only meeting-metadata fields.
export const ADMIN_ONLY_FIELDS = ["meetingStatus", "meetingDate", "willingness", "freeTraining", "fee", "followUp"] as const;

export const OPEN_TEXT_FIELDS = [
  "name",
  "phone",
  "profession",
  "itsId",
  "surveyExpertise",
  "surveyTopics",
  "surveyFormat",
  "surveyDayAvailability",
  "finalTopics",
  "preferredFormat",
  "preferredDays",
  "preferredTime",
  "minNotice",
  "languages",
  "constraints",
  "meetingStatus",
  "willingness",
  "freeTraining",
  "fee",
  "followUp",
] as const;