import { builder } from "../../graphql/builder.js";
import { resolvePaging, paged, type Paged } from "../../graphql/admin-common.js";
import type { ConsultationBookingDoc } from "./consultation.model.js";
import {
  BookingStatusEnum,
  ConsultationBookingRef,
  ConsultationServiceRef,
  ServiceKeyEnum,
} from "./consultation.schema.js";
import {
  getBookingForAdmin,
  listBookingsForAdmin,
  listServicesForAdmin,
  updateBookingStatus,
  upsertConsultationService,
} from "./consultation.service.js";

const AdminBookingFilter = builder.inputType("AdminBookingFilter", {
  fields: (t) => ({
    status: t.field({ type: BookingStatusEnum, required: false }),
    serviceKey: t.field({ type: ServiceKeyEnum, required: false }),
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

export function registerConsultationAdminModule() {
  builder.queryFields((t) => ({
    adminBookings: t.field({
      type: AdminBookingPage,
      authScopes: { admin: true },
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
      authScopes: { admin: true },
      args: { id: t.arg.id({ required: true }) },
      resolve: (_p, { id }) => getBookingForAdmin(String(id)).catch(() => null),
    }),

    adminConsultationServices: t.field({
      type: [ConsultationServiceRef],
      authScopes: { admin: true },
      resolve: () => listServicesForAdmin(),
    }),
  }));

  builder.mutationFields((t) => ({
    updateBookingStatus: t.field({
      type: ConsultationBookingRef,
      authScopes: { admin: true },
      args: {
        id: t.arg.id({ required: true }),
        status: t.arg({ type: BookingStatusEnum, required: true }),
      },
      resolve: (_p, { id, status }) => updateBookingStatus(String(id), status as never),
    }),

    upsertConsultationService: t.field({
      type: ConsultationServiceRef,
      authScopes: { admin: true },
      args: { input: t.arg({ type: ConsultationServiceInput, required: true }) },
      resolve: (_p, { input }) => upsertConsultationService(input as never),
    }),
  }));
}
