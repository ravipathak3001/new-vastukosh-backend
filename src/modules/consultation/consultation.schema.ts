import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import {
  CONSULTATION_SERVICE_KEYS,
  type ConsultationBookingDoc,
  type ConsultationServiceDoc,
} from "./consultation.model.js";
import {
  availableSlots,
  bookConsultation,
  listServices,
} from "./consultation.service.js";

const ServiceKeyEnum = builder.enumType("ConsultationServiceKey", {
  values: CONSULTATION_SERVICE_KEYS,
});

const ConsultationServiceRef = builder
  .objectRef<ConsultationServiceDoc>("ConsultationService")
  .implement({
    fields: (t) => ({
      key: t.field({ type: ServiceKeyEnum, resolve: (s) => s.key as never }),
      name: t.field({ type: LocalizedStringRef, resolve: (s) => s.name }),
      meta: t.field({ type: LocalizedStringRef, resolve: (s) => s.meta }),
      durationMins: t.exposeInt("durationMins"),
      price: t.exposeFloat("price"),
      icon: t.exposeString("icon"),
    }),
  });

const ConsultationBookingRef = builder
  .objectRef<ConsultationBookingDoc>("ConsultationBooking")
  .implement({
    fields: (t) => ({
      id: t.field({ type: "ID", resolve: (b) => String(b._id) }),
      serviceKey: t.field({ type: ServiceKeyEnum, resolve: (b) => b.serviceKey as never }),
      date: t.exposeString("date"),
      slot: t.exposeString("slot"),
      name: t.exposeString("name"),
      email: t.exposeString("email"),
      status: t.exposeString("status"),
    }),
  });

const BirthDetailsInput = builder.inputType("ConsultationBirthDetailsInput", {
  fields: (t) => ({
    date: t.string({ required: false }),
    time: t.string({ required: false }),
    place: t.string({ required: false }),
  }),
});

const BookConsultationInputRef = builder.inputType("BookConsultationInput", {
  fields: (t) => ({
    serviceKey: t.field({ type: ServiceKeyEnum, required: true }),
    date: t.string({ required: true }),
    slot: t.string({ required: true }),
    name: t.string({ required: true }),
    email: t.string({ required: true }),
    phone: t.string({ required: false }),
    birthDetails: t.field({ type: BirthDetailsInput, required: false }),
    notes: t.string({ required: false }),
  }),
});

export function registerConsultationModule() {
  builder.queryFields((t) => ({
    consultationServices: t.field({
      type: [ConsultationServiceRef],
      resolve: () => listServices(),
    }),
    availableSlots: t.field({
      type: ["String"],
      args: { date: t.arg.string({ required: true }) },
      resolve: (_p, { date }) => availableSlots(date),
    }),
  }));

  builder.mutationFields((t) => ({
    bookConsultation: t.field({
      type: ConsultationBookingRef,
      args: { input: t.arg({ type: BookConsultationInputRef, required: true }) },
      resolve: (_p, { input }, ctx) =>
        bookConsultation(
          {
            serviceKey: input.serviceKey as never,
            date: input.date,
            slot: input.slot,
            name: input.name,
            email: input.email,
            phone: input.phone ?? undefined,
            birthDetails: input.birthDetails
              ? {
                  date: input.birthDetails.date ?? undefined,
                  time: input.birthDetails.time ?? undefined,
                  place: input.birthDetails.place ?? undefined,
                }
              : undefined,
            notes: input.notes ?? undefined,
          },
          ctx.user?.id,
        ),
    }),
  }));
}
