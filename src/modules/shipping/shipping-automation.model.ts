import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";

/**
 * Singleton document (`key: "default"`) — the on/off switches for Shiprocket
 * automation, editable from the admin Settings page. `lastPolledAt` lets the
 * always-on cron tick (see `shipping-automation.job.ts`) self-throttle to
 * `pollIntervalMinutes` without needing to reschedule the job itself.
 */
const shippingAutomationSettingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    autoSchedulePickup: { type: Boolean, default: true },
    pollEnabled: { type: Boolean, default: true },
    pollIntervalMinutes: { type: Number, default: 30, min: 5, max: 1440 },
    lastPolledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type ShippingAutomationSettings = InferSchemaType<typeof shippingAutomationSettingsSchema>;
export type ShippingAutomationSettingsDoc = HydratedDocument<ShippingAutomationSettings>;
export const ShippingAutomationSettingsModel = defineModel(
  "ShippingAutomationSettings",
  shippingAutomationSettingsSchema,
);
