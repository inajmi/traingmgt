import { DateTime } from "luxon";

import { config } from "../env";

export function appTz(): string {
  return config.appTz;
}

/** Parse an ISO time / date-time into a luxon DateTime in the app timezone. */
export function fromInput(value: string, opts: { zone?: string } = {}): DateTime {
  const zone = opts.zone ?? appTz();
  const dt = DateTime.fromISO(value, { zone });
  if (!dt.isValid) throw new Error(`Invalid date/time: "${value}"`);
  return dt;
}

/** Format a Date into the app timezone. Always go through luxon; never format manually. */
export function fmt(d: Date | null | undefined, format?: string): string | null {
  if (!d) return null;
  const dt = DateTime.fromJSDate(d, { zone: appTz() });
  return format ? dt.toFormat(format) : dt.toISO();
}

export function monthNames(): string[] {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}

export function currentYear(): number {
  return DateTime.now().setZone(appTz()).year;
}

/** YYYY-MM-DD date string from a js Date, in app tz. */
export function toDateString(d: Date): string {
  return DateTime.fromJSDate(d, { zone: appTz() }).toISODate() ?? "";
}