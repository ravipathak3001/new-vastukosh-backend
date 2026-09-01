import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";
import { localizedSchema } from "../../shared/localized.js";

export const CONSULTATION_SERVICE_KEYS = ["astro", "vastu", "gem"] as const;
export type ConsultationServiceKey = (typeof CONSULTATION_SERVICE_KEYS)[number];

const consultationServiceSchema = new Schema(
  {
    key: { type: String, enum: CONSULTATION_SERVICE_KEYS, required: true, unique: true },
    name: { type: localizedSchema, required: true },
    meta: { type: localizedSchema, required: true },
    durationMins: { type: Number, required: true },
    price: { type: Number, required: true },
    icon: { type: String, default: "stars" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);
export type ConsultationService = InferSchemaType<typeof consultationServiceSchema>;
export type ConsultationServiceDoc = HydratedDocument<ConsultationService>;
export const ConsultationServiceModel = defineModel("ConsultationService", consultationServiceSchema);

export const BOOKING_STATUSES = ["requested", "confirmed", "completed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const bookingSchema = new Schema(
  {
    serviceKey: { type: String, enum: CONSULTATION_SERVICE_KEYS, required: true },
    date: { type: String, required: true }, // ISO yyyy-mm-dd
    slot: { type: String, required: true }, // HH:mm
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    birthDetails: {
      date: { type: String, default: "" },
      time: { type: String, default: "" },
      place: { type: String, default: "" },
    },
    notes: { type: String, default: "" },
    status: { type: String, enum: BOOKING_STATUSES, default: "requested", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true },
);
bookingSchema.index({ date: 1, slot: 1 });

export type ConsultationBooking = InferSchemaType<typeof bookingSchema>;
export type ConsultationBookingDoc = HydratedDocument<ConsultationBooking>;
export const ConsultationBookingModel = defineModel("ConsultationBooking", bookingSchema);
