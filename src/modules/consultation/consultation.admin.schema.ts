import { builder } from "../../graphql/builder.js";
import { resolvePaging, paged, type Paged } from "../../graphql/admin-common.js";
import type { ConsultationBookingDoc } from "./consultation.model.js";
import {
  BookingKindEnum,
  BookingStatusEnum,
  ConsultationBookingRef,
  ConsultationServiceRef,
  PoojaServiceRef,
  ServiceKeyEnum,
} from "./consultation.schema.js";
import {
  completeBooking,
  confirmBooking,
  getBookingForAdmin,
  listBookingsForAdmin,
  listPoojasForAdmin,
  listServicesForAdmin,
  proposeReschedule,
  refundBooking,
  updateBookingStatus,
  upsertConsultationService,
  upsertPoojaService,
} from "./consultation.service.js";

const AdminBookingFilter = builder.inputType("AdminBookingFilter", {
  fields: (t) => ({
    status: t.field({ type: BookingStatusEnum, required: false }),
    kind: t.field({ type: BookingKindEnum, required: false }),
    /** Consultation service key or pooja slug. */
    serviceKey: t.string({ required: false }),
    search: t.string({ required: false }),
    dateFrom: t.string({ required: false }),
    dateTo: t.string({ required: false }),
  }),
});

const AdminBookingPage = builder
  .objectRef<Paged<ConsultationBookingDoc>>("AdminBookingPage")
  .implement({
    fields: (t) => ({
      items: t.field({ type: [ConsultationBookingRef], resolve: (p) => p.items }),
      total: t.exposeInt("total"),
      page: t.exposeInt("page"),
      pageSize: t.exposeInt("pageSize"),
    }),
  });

const ConsultationServiceInput = builder.inputType("ConsultationServiceInput", {
  fields: (t) => ({
    key: t.field({ type: ServiceKeyEnum, required: true }),
    name: t.field({ type: "JSON", required: false }),
    meta: t.field({ type: "JSON", required: false }),
    durationMins: t.int({ required: false }),
    price: t.float({ required: false }),
    icon: t.string({ required: false }),
    order: t.int({ required: false }),
    active: t.boolean({ required: false }),
  }),
});

const PoojaServiceInput = builder.inputType("PoojaServiceInput", {
  fields: (t) => ({
    slug: t.string({ required: true }),
    name: t.field({ type: "JSON", required: false }),
    description: t.field({ type: "JSON", required: false }),
    durationMins: t.int({ required: false }),
    price: t.float({ required: false }),
    image: t.string({ required: false }),
    icon: t.string({ required: false }),
    order: t.int({ required: false }),
    active: t.boolean({ required: false }),
  }),
});

export function registerConsultationAdminModule() {
  builder.queryFields((t) => ({
    adminBookings: t.field({
      type: AdminBookingPage,
      authScopes: { permission: "bookings.view" },
      args: {
        filter: t.arg({ type: AdminBookingFilter, required: false }),
        page: t.arg.int({ required: false }),
        pageSize: t.arg.int({ required: false }),
      },
      resolve: async (_p, args) => {
        const { page, pageSize, skip, limit } = resolvePaging(args);
        const { items, total } = await listBookingsForAdmin(
          {
            status: args.filter?.status ?? null,
            kind: (args.filter?.kind ?? null) as never,
            serviceKey: args.filter?.serviceKey ?? null,
            search: args.filter?.search ?? null,
            dateFrom: args.filter?.dateFrom ?? null,
            dateTo: args.filter?.dateTo ?? null,
          },
          skip,
          limit,
        );
        return paged(items, total, { page, pageSize });
      },
    }),

    adminBooking: t.field({
      type: ConsultationBookingRef,
      nullable: true,
      authScopes: { permission: "bookings.view" },
      args: { id: t.arg.id({ required: true }) },
      resolve: (_p, { id }) => getBookingForAdmin(String(id)).catch(() => null),
    }),

    adminConsultationServices: t.field({
      type: [ConsultationServiceRef],
      authScopes: { permission: "bookings.view" },
      resolve: () => listServicesForAdmin(),
    }),

    adminPoojaServices: t.field({
      type: [PoojaServiceRef],
      authScopes: { permission: "bookings.view" },
      resolve: () => listPoojasForAdmin(),
    }),
  }));

  builder.mutationFields((t) => ({
    /** Confirms a paid booking. Consultations get a video meeting link (emailed to the customer). */
    confirmBooking: t.field({
      type: ConsultationBookingRef,
      authScopes: { permission: "bookings.manage" },
      args: { id: t.arg.id({ required: true }), note: t.arg.string({ required: false }) },
      resolve: (_p, { id, note }) => confirmBooking(String(id), note ?? ""),
    }),

    /** Offers the customer a new date/slot; they accept (confirmed) or decline (refunded). */
    proposeBookingReschedule: t.field({
      type: ConsultationBookingRef,
      authScopes: { permission: "bookings.manage" },
      args: {
        id: t.arg.id({ required: true }),
        date: t.arg.string({ required: true }),
        slot: t.arg.string({ required: true }),
        note: t.arg.string({ required: false }),
      },
      resolve: (_p, { id, date, slot, note }) =>
        proposeReschedule(String(id), date, slot, note ?? ""),
    }),

    /** Marks a confirmed booking done; for poojas, shares the recording link with the devotee. */
    completeBooking: t.field({
      type: ConsultationBookingRef,
      authScopes: { permission: "bookings.manage" },
      args: { id: t.arg.id({ required: true }), recordingUrl: t.arg.string({ required: false }) },
      resolve: (_p, { id, recordingUrl }) => completeBooking(String(id), recordingUrl),
    }),

    /** Full refund through the payment gateway (cancels any meeting). */
    refundBooking: t.field({
      type: ConsultationBookingRef,
      authScopes: { permission: "bookings.manage" },
      args: { id: t.arg.id({ required: true }), note: t.arg.string({ required: false }) },
      resolve: (_p, { id, note }) => refundBooking(String(id), note ?? ""),
    }),

    upsertPoojaService: t.field({
      type: PoojaServiceRef,
      authScopes: { permission: "bookings.manage" },
      args: { input: t.arg({ type: PoojaServiceInput, required: true }) },
      resolve: (_p, { input }) => upsertPoojaService(input as never),
    }),

    /** Side-effect-free moves only: `cancelled` (unpaid), `completed`, or `requested` (mark paid offline). */
    updateBookingStatus: t.field({
      type: ConsultationBookingRef,
      authScopes: { permission: "bookings.manage" },
      args: {
        id: t.arg.id({ required: true }),
        status: t.arg({ type: BookingStatusEnum, required: true }),
      },
      resolve: (_p, { id, status }) => updateBookingStatus(String(id), status as never),
    }),

    upsertConsultationService: t.field({
      type: ConsultationServiceRef,
      authScopes: { permission: "bookings.manage" },
      args: { input: t.arg({ type: ConsultationServiceInput, required: true }) },
      resolve: (_p, { input }) => upsertConsultationService(input as never),
    }),
  }));
}
