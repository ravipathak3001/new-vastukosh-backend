import { badInput, notFound } from "../../shared/errors.js";
import { logger } from "../../config/logger.js";
import { OrderModel, type OrderDoc, type OrderStatus } from "../order/order.model.js";
import { advanceStatus } from "../order/order.service.js";
import {
  CarrierError,
  getShippingProvider,
  isDeliveredStatus,
  type ShipmentAwb,
} from "./shipping.provider.js";
import {
  ShippingAutomationSettingsModel,
  type ShippingAutomationSettingsDoc,
} from "./shipping-automation.model.js";

/**
 * Runs a carrier call; a carrier rejection becomes a BAD_INPUT error carrying
 * the carrier's reason, so the admin sees it instead of "Internal server error".
 */
export async function carrier<T>(action: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CarrierError) {
      logger.warn({ err }, `${err.carrier} rejected: ${action}`);
      throw badInput(`${err.carrier} couldn't ${action}: ${err.carrierMessage}`);
    }
    throw err;
  }
}

export async function getAutomationSettings(): Promise<ShippingAutomationSettingsDoc> {
  return ShippingAutomationSettingsModel.findOneAndUpdate(
    { key: "default" },
    {},
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

export async function updateAutomationSettings(patch: {
  autoSchedulePickup?: boolean;
  pollEnabled?: boolean;
  pollIntervalMinutes?: number;
}): Promise<ShippingAutomationSettingsDoc> {
  return ShippingAutomationSettingsModel.findOneAndUpdate(
    { key: "default" },
    { $set: patch },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

/** Orders too early (unpaid) or too late (already shipped/closed) to verify. */
const VERIFIABLE_STATUSES: OrderStatus[] = ["paid", "consecration", "packed"];

/**
 * Marks an order reviewed and ready to ship. Purely a gate + audit trail — it
 * does not touch the carrier or the order status; `startDelivery` is the only
 * thing that talks to Shiprocket.
 */
export async function verifyOrder(orderNo: string, adminId: string): Promise<OrderDoc> {
  const order = await OrderModel.findOne({ orderNo });
  if (!order) throw notFound("Order");
  if (!VERIFIABLE_STATUSES.includes(order.status)) {
    throw badInput(`Cannot verify an order in status ${order.status}`);
  }
  order.verifiedAt = new Date();
  order.verifiedBy = adminId as never;
  await order.save();
  return order;
}

/**
 * The one action that actually reaches Shiprocket: creates the carrier order,
 * assigns an AWB, and advances the order to `in_transit`. Requires `verifyOrder`
 * to have run first and the order to be `packed`.
 */
export async function startDelivery(orderNo: string): Promise<OrderDoc> {
  const order = await OrderModel.findOne({ orderNo });
  if (!order) throw notFound("Order");
  if (!order.verifiedAt) throw badInput("Verify the order before starting delivery");
  if (order.status !== "packed") {
    throw badInput(`Order must be packed before delivery can start (currently ${order.status})`);
  }

  const provider = getShippingProvider();
  const shipment = await carrier("create the shipment", () => provider.createShipment(order));
  const initialStatus = shipment.awbCode ? "AWB ASSIGNED" : "AWB PENDING";

  order.shipment = {
    provider: provider.name,
    providerOrderId: shipment.providerOrderId,
    shipmentId: shipment.shipmentId,
    awbCode: shipment.awbCode,
    courierId: shipment.courierId,
    courierName: shipment.courierName,
    trackingUrl: shipment.trackingUrl,
    labelUrl: "",
    invoiceUrl: "",
    pickupScheduledDate: null,
    expectedDeliveryDate: null,
    rawStatus: initialStatus,
    statusHistory: [{ status: initialStatus, at: new Date() }],
    cancelledAt: null,
  } as never;
  await order.save();

  logger.info({ orderNo, awb: shipment.awbCode, courier: shipment.courierName }, "Shipment created");
  // The carrier order exists even without an AWB, so the order still moves on;
  // the poller / webhook fill the AWB in once it is assigned (e.g. from the dashboard).
  const updated = await advanceStatus(
    order,
    "in_transit",
    shipment.awbCode
      ? `Shipment created via ${provider.name} — AWB ${shipment.awbCode} (${shipment.courierName})`
      : `Shipment created via ${provider.name} — no AWB assigned yet: ${shipment.awbError ?? "unknown reason"}. Assign it in the ${provider.name} dashboard; it syncs here automatically.`,
  );

  const settings = await getAutomationSettings();
  if (settings.autoSchedulePickup && shipment.awbCode) {
    try {
      await schedulePickupOn(updated, provider);
    } catch (err) {
      // Shipment creation already succeeded — pickup can still be scheduled manually.
      logger.warn({ orderNo, err }, "Auto pickup scheduling failed");
    }
  }
  return updated;
}

async function schedulePickupOn(
  order: OrderDoc,
  provider: ReturnType<typeof getShippingProvider>,
): Promise<void> {
  if (!order.shipment?.shipmentId) throw badInput("No shipment on this order yet");
  const shipmentId = order.shipment.shipmentId;

  // The AWB (and maybe the pickup) may have been set up in the carrier dashboard
  // since creation — sync first, and don't request a pickup twice.
  if (!order.shipment.awbCode) {
    const awb = await carrier("look up the shipment", () => provider.getShipmentAwb(shipmentId));
    if (!awb) {
      throw badInput(
        `No AWB is assigned to this shipment yet — assign a courier in the ${provider.name} dashboard first`,
      );
    }
    applyLateAwb(order, awb);
    if (order.shipment.pickupScheduledDate) {
      await order.save();
      return;
    }
  }

  const { pickupScheduledDate } = await carrier("schedule the pickup", () =>
    provider.schedulePickup(shipmentId),
  );
  order.shipment.pickupScheduledDate = pickupScheduledDate;
  await order.save();
}

export async function schedulePickup(orderNo: string): Promise<OrderDoc> {
  const order = await OrderModel.findOne({ orderNo });
  if (!order) throw notFound("Order");
  await schedulePickupOn(order, getShippingProvider());
  return order;
}

export async function cancelShipment(orderNo: string, note = ""): Promise<OrderDoc> {
  const order = await OrderModel.findOne({ orderNo });
  if (!order) throw notFound("Order");
  if (!order.shipment?.shipmentId) throw badInput("No shipment on this order to cancel");

  const provider = getShippingProvider();
  const shipmentId = order.shipment.shipmentId;
  await carrier("cancel the shipment", () => provider.cancelShipment(shipmentId));
  order.shipment.cancelledAt = new Date();
  await order.save();

  if (order.status === "in_transit" || order.status === "packed") {
    return advanceStatus(order, "cancelled", note || "Shipment cancelled by admin");
  }
  return order;
}

/** Copies an AWB assigned after shipment creation onto the order. */
function applyLateAwb(
  order: OrderDoc,
  awb: Pick<ShipmentAwb, "awbCode"> & Partial<ShipmentAwb>,
): void {
  if (!order.shipment) return;
  if (awb.pickupScheduledDate && !order.shipment.pickupScheduledDate) {
    order.shipment.pickupScheduledDate = awb.pickupScheduledDate;
  }
  order.shipment.awbCode = awb.awbCode;
  if (awb.courierId) order.shipment.courierId = awb.courierId;
  if (awb.courierName) order.shipment.courierName = awb.courierName;
  order.shipment.trackingUrl = awb.trackingUrl || `https://shiprocket.co/tracking/${awb.awbCode}`;
  order.shipment.rawStatus = "AWB ASSIGNED";
  order.shipment.statusHistory.push({ status: "AWB ASSIGNED", at: new Date() });
  logger.info({ orderNo: order.orderNo, awb: awb.awbCode }, "Late AWB synced from carrier");
}

/** Applied from the carrier webhook (and any future polling fallback). */
export async function syncShipmentStatus(
  awbCode: string,
  rawStatus: string,
  delivered: boolean,
  ref: { orderNo?: string; courierName?: string } = {},
): Promise<void> {
  let order = await OrderModel.findOne({ "shipment.awbCode": awbCode });
  if (!order && ref.orderNo) {
    // AWB assigned after creation (e.g. from the dashboard): match by order number.
    order = await OrderModel.findOne({
      orderNo: ref.orderNo,
      "shipment.shipmentId": { $ne: "" },
      "shipment.awbCode": "",
      "shipment.cancelledAt": null,
    });
    if (order) applyLateAwb(order, { awbCode, courierName: ref.courierName });
  }
  if (!order || !order.shipment) {
    logger.warn({ awbCode }, "Shipment webhook for unknown AWB");
    return;
  }

  order.shipment.rawStatus = rawStatus;
  order.shipment.statusHistory.push({ status: rawStatus, at: new Date() });
  await order.save();

  if (delivered && order.status === "in_transit") {
    await advanceStatus(order, "delivered", `Delivered — ${rawStatus}`);
  }
}

/**
 * Safety-net fallback for shipments whose carrier webhook never arrived.
 * Self-throttles against `pollIntervalMinutes` so the cron tick (fixed cadence,
 * see `shipping-automation.job.ts`) can run often without over-polling the
 * carrier API. No-ops entirely when `pollEnabled` is off.
 */
export async function pollShipmentStatuses(): Promise<void> {
  const settings = await getAutomationSettings();
  if (!settings.pollEnabled) return;

  const dueAt = settings.lastPolledAt
    ? settings.lastPolledAt.getTime() + settings.pollIntervalMinutes * 60_000
    : 0;
  if (Date.now() < dueAt) return;

  settings.lastPolledAt = new Date();
  await settings.save();

  const provider = getShippingProvider();

  // Shipments created without an AWB: pick it up once the carrier has one.
  const pending = await OrderModel.find({
    status: "in_transit",
    "shipment.shipmentId": { $ne: "" },
    "shipment.awbCode": "",
    "shipment.cancelledAt": null,
  });
  for (const order of pending) {
    if (!order.shipment?.shipmentId) continue;
    try {
      const awb = await provider.getShipmentAwb(order.shipment.shipmentId);
      if (!awb) continue;
      applyLateAwb(order, awb);
      await order.save();
    } catch (err) {
      logger.warn({ orderNo: order.orderNo, err }, "Late AWB lookup failed");
    }
  }

  const orders = await OrderModel.find({
    status: "in_transit",
    "shipment.awbCode": { $ne: "" },
    "shipment.cancelledAt": null,
  });

  for (const order of orders) {
    if (!order.shipment?.awbCode) continue;
    try {
      const { rawStatus, expectedDeliveryDate } = await provider.track(order.shipment.awbCode);
      if (!rawStatus || rawStatus === order.shipment.rawStatus) continue;

      order.shipment.rawStatus = rawStatus;
      if (expectedDeliveryDate) order.shipment.expectedDeliveryDate = expectedDeliveryDate;
      order.shipment.statusHistory.push({ status: rawStatus, at: new Date() });
      await order.save();

      if (isDeliveredStatus(rawStatus)) {
        await advanceStatus(order, "delivered", `Delivered — ${rawStatus}`);
      }
    } catch (err) {
      logger.warn({ orderNo: order.orderNo, err }, "Shipment status poll failed");
    }
  }
}
