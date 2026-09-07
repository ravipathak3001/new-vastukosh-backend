import { builder } from "../../graphql/builder.js";
import type { OrderDoc } from "../order/order.model.js";
import { OrderRef } from "../order/order.schema.js";
import type { ShippingAutomationSettingsDoc } from "./shipping-automation.model.js";
import {
  cancelShipment,
  getAutomationSettings,
  schedulePickup,
  startDelivery,
  updateAutomationSettings,
  verifyOrder,
} from "./shipping.service.js";

type ShipmentDoc = NonNullable<OrderDoc["shipment"]>;

const ShipmentStatusHistoryRef = builder
  .objectRef<ShipmentDoc["statusHistory"][number]>("ShipmentStatusHistoryEntry")
  .implement({
    fields: (t) => ({
      status: t.exposeString("status"),
      at: t.field({ type: "DateTime", resolve: (e) => e.at }),
    }),
  });

const OrderShipmentRef = builder.objectRef<ShipmentDoc>("OrderShipment").implement({
  fields: (t) => ({
    provider: t.exposeString("provider"),
    shipmentId: t.exposeString("shipmentId"),
    awbCode: t.exposeString("awbCode"),
    courierName: t.exposeString("courierName"),
    trackingUrl: t.exposeString("trackingUrl"),
    labelUrl: t.exposeString("labelUrl"),
    invoiceUrl: t.exposeString("invoiceUrl"),
    pickupScheduledDate: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (s) => s.pickupScheduledDate,
    }),
    expectedDeliveryDate: t.field({
      type: "DateTime",
      nullable: true,
      resolve: (s) => s.expectedDeliveryDate,
    }),
    rawStatus: t.exposeString("rawStatus"),
    statusHistory: t.field({ type: [ShipmentStatusHistoryRef], resolve: (s) => s.statusHistory }),
    cancelledAt: t.field({ type: "DateTime", nullable: true, resolve: (s) => s.cancelledAt }),
  }),
});

builder.objectField(OrderRef, "verifiedAt", (t) =>
  t.field({ type: "DateTime", nullable: true, authScopes: { permission: "orders.view" }, resolve: (o) => o.verifiedAt }),
);
builder.objectField(OrderRef, "verifiedBy", (t) =>
  t.field({
    type: "ID",
    nullable: true,
    authScopes: { permission: "orders.view" },
    resolve: (o) => (o.verifiedBy ? String(o.verifiedBy) : null),
  }),
);
// Visible to whoever can see the order's own operational data (admins with
// orders.view) *or* the customer who placed it — unlike `verifiedAt`/`shipment`'s
// admin-only siblings above, tracking info is exactly what the owner needs to
// see on their own order history page.
builder.objectField(OrderRef, "shipment", (t) =>
  t.field({
    type: OrderShipmentRef,
    nullable: true,
    resolve: (o, _args, ctx) => {
      const isOwner = Boolean(ctx.user && o.userId && String(o.userId) === ctx.user.id);
      const canViewAnyOrder = ctx.user?.permissions.includes("orders.view") ?? false;
      return isOwner || canViewAnyOrder ? o.shipment : null;
    },
  }),
);

const ShippingAutomationSettingsRef = builder
  .objectRef<ShippingAutomationSettingsDoc>("ShippingAutomationSettings")
  .implement({
    fields: (t) => ({
      autoSchedulePickup: t.exposeBoolean("autoSchedulePickup"),
      pollEnabled: t.exposeBoolean("pollEnabled"),
      pollIntervalMinutes: t.exposeInt("pollIntervalMinutes"),
      lastPolledAt: t.field({ type: "DateTime", nullable: true, resolve: (s) => s.lastPolledAt }),
    }),
  });

const ShippingAutomationSettingsInput = builder.inputType("ShippingAutomationSettingsInput", {
  fields: (t) => ({
    autoSchedulePickup: t.boolean({ required: false }),
    pollEnabled: t.boolean({ required: false }),
    pollIntervalMinutes: t.int({ required: false }),
  }),
});

export function registerShippingModule() {
  builder.queryFields((t) => ({
    adminShippingAutomationSettings: t.field({
      type: ShippingAutomationSettingsRef,
      authScopes: { permission: "orders.view" },
      resolve: () => getAutomationSettings(),
    }),
  }));

  builder.mutationFields((t) => ({
    verifyOrder: t.field({
      type: OrderRef,
      authScopes: { permission: "orders.manage" },
      args: { orderNo: t.arg.string({ required: true }) },
      resolve: (_p, { orderNo }, ctx) => verifyOrder(orderNo, ctx.user!.id),
    }),

    startDelivery: t.field({
      type: OrderRef,
      authScopes: { permission: "orders.manage" },
      args: { orderNo: t.arg.string({ required: true }) },
      resolve: (_p, { orderNo }) => startDelivery(orderNo),
    }),

    schedulePickup: t.field({
      type: OrderRef,
      authScopes: { permission: "orders.manage" },
      args: { orderNo: t.arg.string({ required: true }) },
      resolve: (_p, { orderNo }) => schedulePickup(orderNo),
    }),

    cancelShipment: t.field({
      type: OrderRef,
      authScopes: { permission: "orders.manage" },
      args: {
        orderNo: t.arg.string({ required: true }),
        note: t.arg.string({ required: false }),
      },
      resolve: (_p, { orderNo, note }) => cancelShipment(orderNo, note ?? ""),
    }),

    updateShippingAutomationSettings: t.field({
      type: ShippingAutomationSettingsRef,
      authScopes: { permission: "orders.automation" },
      args: { input: t.arg({ type: ShippingAutomationSettingsInput, required: true }) },
      resolve: (_p, { input }) =>
        updateAutomationSettings({
          autoSchedulePickup: input.autoSchedulePickup ?? undefined,
          pollEnabled: input.pollEnabled ?? undefined,
          pollIntervalMinutes: input.pollIntervalMinutes ?? undefined,
        }),
    }),
  }));
}
