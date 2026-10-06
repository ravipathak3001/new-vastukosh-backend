import cron, { type ScheduledTask } from "node-cron";
import { logger } from "../../config/logger.js";
import { expireStaleHolds } from "./consultation.service.js";

let task: ScheduledTask | null = null;

/**
 * Every 10 minutes, cancels unpaid bookings whose slot hold lapsed. Purely
 * housekeeping — `availableSlots` already ignores expired holds, and a late
 * capture still revives a cancelled booking (see `confirmBookingPaid`).
 */
export function startBookingJobs(): void {
  if (task) return;
  task = cron.schedule("*/10 * * * *", () => {
    expireStaleHolds()
      .then((n) => n > 0 && logger.info({ count: n }, "Expired unpaid booking holds"))
      .catch((err) => logger.error({ err }, "Booking hold cleanup crashed"));
  });
  logger.info("Booking cleanup cron started");
}

export function stopBookingJobs(): void {
  task?.stop();
  task = null;
}
