import { env } from "../../config/env.js";

/**
 * Time helpers for bookings. Every date/slot in the booking system is a
 * wall-clock time in `BOOKING_TIMEZONE` (IST) — never converted to UTC.
 */

/** Current date (`yyyy-mm-dd`) and minutes-since-midnight in the booking time zone. */
export function nowInZone(): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: env.BOOKING_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function slotMinutes(slot: string): number {
  const [h = 0, m = 0] = slot.split(":").map(Number);
  return h * 60 + m;
}

/** `yyyy-mm-ddTHH:mm:00` for `date slot` shifted by `addMins` — calendar arithmetic only, no zone conversion. */
export function localDateTime(date: string, slot: string, addMins = 0): string {
  const [y = 0, mo = 1, d = 1] = date.split("-").map(Number);
  const [h = 0, mi = 0] = slot.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi + addMins)).toISOString().slice(0, 19);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** `HH:mm` for minutes-since-midnight. */
export function minutesToSlot(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/** Weekday (0 = Sunday) of a `yyyy-mm-dd` date. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
