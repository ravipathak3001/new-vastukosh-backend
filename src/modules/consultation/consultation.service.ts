import { badInput } from "../../shared/errors.js";
import {
  ConsultationBookingModel,
  ConsultationServiceModel,
  type ConsultationServiceKey,
} from "./consultation.model.js";

/** Slots offered per working day (mirrors the frontend booking flow). */
export const DAILY_SLOTS = [
  "09:30",
  "10:30",
  "11:30",
  "12:30",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
] as const;

export async function listServices() {
  return ConsultationServiceModel.find({ active: true }).sort({ order: 1 });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Free slots for a given ISO date: closed Sundays, past dates and booked slots removed. */
export async function availableSlots(date: string): Promise<string[]> {
  if (!ISO_DATE.test(date)) throw badInput("date must be yyyy-mm-dd");
  const day = new Date(`${date}T00:00:00`);
  if (Number.isNaN(day.getTime())) throw badInput("Invalid date");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (day < today || day.getDay() === 0) return [];

  const taken = await ConsultationBookingModel.find({
    date,
    status: { $in: ["requested", "confirmed"] },
  }).select("slot");
  const takenSet = new Set(taken.map((b) => b.slot));
  return DAILY_SLOTS.filter((s) => !takenSet.has(s));
}

export type BookConsultationInput = {
  serviceKey: ConsultationServiceKey;
  date: string;
  slot: string;
  name: string;
  email: string;
  phone?: string;
  birthDetails?: { date?: string; time?: string; place?: string };
  notes?: string;
};

export async function bookConsultation(
  input: BookConsultationInput,
  userId?: string,
) {
  const free = await availableSlots(input.date);
  if (!free.includes(input.slot)) {
    throw badInput("That slot is no longer available — please pick another");
  }
  return ConsultationBookingModel.create({
    serviceKey: input.serviceKey,
    date: input.date,
    slot: input.slot,
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    phone: input.phone?.trim() ?? "",
    birthDetails: {
      date: input.birthDetails?.date ?? "",
      time: input.birthDetails?.time ?? "",
      place: input.birthDetails?.place ?? "",
    },
    notes: input.notes?.trim() ?? "",
    userId: userId ?? null,
  });
}
