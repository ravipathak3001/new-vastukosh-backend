import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { ConsultationBookingModel } from "./consultation.model.js";
import { sendBookingReminder } from "./booking.emails.js";

/** How far ahead of the start the reminder goes out. */
const LEAD_MINUTES = 60;

/** Offset of `timeZone` from UTC at instant `ts`, in ms. */
function zoneOffset(ts: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - ts;
}

/** `2026-10-12` + `10:30` in the booking timezone → epoch ms. */
export function slotStartsAt(date: string, slot: string, timeZone = env.BOOKING_TIMEZONE): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = slot.split(":").map(Number);
  const wall = Date.UTC(y!, m! - 1, d!, h!, min!);
  return wall - zoneOffset(wall, timeZone);
}

function isoDay(ts: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
}

/**
 * Runs every minute: emails anyone whose confirmed session starts within the
 * next hour. `reminderSentFor` is claimed atomically per date+slot, so a
 * rescheduled booking gets a fresh reminder and nobody gets two.
 */
export async function sendDueBookingReminders(now = Date.now()): Promise<number> {
  const tz = env.BOOKING_TIMEZONE;
  const days = [isoDay(now, tz), isoDay(now + 24 * 3600_000, tz)];
  const candidates = await ConsultationBookingModel.find({ status: "confirmed", date: { $in: days } });
  let sent = 0;
  for (const b of candidates) {
    const key = `${b.date}T${b.slot}`;
    if (b.reminderSentFor === key) continue;
    const startsIn = slotStartsAt(b.date, b.slot, tz) - now;
    if (startsIn <= 0 || startsIn > LEAD_MINUTES * 60_000) continue;
    const claimed = await ConsultationBookingModel.findOneAndUpdate(
      { _id: b._id, status: "confirmed", reminderSentFor: { $ne: key } },
      { $set: { reminderSentFor: key } },
      { new: true },
    );
    if (!claimed) continue;
    await sendBookingReminder(claimed);
    sent++;
  }
  if (sent) logger.info({ sent }, "Booking reminders sent");
  return sent;
}
