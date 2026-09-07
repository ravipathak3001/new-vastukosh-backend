import cron, { type ScheduledTask } from "node-cron";
import { logger } from "../../config/logger.js";
import { pollShipmentStatuses } from "./shipping.service.js";

let task: ScheduledTask | null = null;

/**
 * Fixed 5-minute cron tick; `pollShipmentStatuses` self-throttles against the
 * admin-configured `pollIntervalMinutes` and no-ops when polling is disabled.
 * A fixed cadence here means turning the interval up/down in Settings takes
 * effect on the next tick with no job to reschedule.
 */
export function startShippingAutomation(): void {
  if (task) return;
  task = cron.schedule("*/5 * * * *", () => {
    pollShipmentStatuses().catch((err) => logger.error({ err }, "Shipment status poll crashed"));
  });
  logger.info("Shipping automation cron started");
}

export function stopShippingAutomation(): void {
  task?.stop();
  task = null;
}
