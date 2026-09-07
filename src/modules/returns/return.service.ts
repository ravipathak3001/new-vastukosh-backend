import { customAlphabet } from "nanoid";
import { badInput, forbidden, notFound } from "../../shared/errors.js";
import { logger } from "../../config/logger.js";
import { searchRegex } from "../../graphql/admin-common.js";
import { OrderModel, type OrderDoc } from "../order/order.model.js";
import { getShippingProvider } from "../shipping/shipping.provider.js";
import { ReturnModel, type ReturnDoc, type ReturnStatus } from "./return.model.js";

export const RETURN_WINDOW_DAYS = 7;

const returnDigits = customAlphabet("0123456789", 3);
function generateReturnNo(): string {
  return `RET-${returnDigits()}-Om`;
}

/** Allowed forward transitions for a return, mirroring the order state machine. */
const TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["pickup_scheduled", "cancelled"],
  rejected: [],
  pickup_scheduled: ["received", "cancelled"],
  received: ["refunded"],
  refunded: [],
  cancelled: [],
};

function canTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

async function advance(ret: ReturnDoc, to: ReturnStatus, note = ""): Promise<ReturnDoc> {
  if (!canTransition(ret.status, to)) {
    throw badInput(`Cannot move a return from ${ret.status} to ${to}`);
  }
  ret.status = to;
  ret.timeline.push({ status: to, at: new Date(), note });
  await ret.save();
  return ret;
}

export type ReturnEligibility = {
  eligible: boolean;
  reason: string;
  deadline: Date | null;
  items: { productSlug: string; name: string; qty: number; maxQty: number }[];
};

export async function getReturnEligibility(order: OrderDoc): Promise<ReturnEligibility> {
  if (order.status !== "delivered") {
    return { eligible: false, reason: "Order has not been delivered yet", deadline: null, items: [] };
  }
  const deliveredEntry = [...order.timeline].reverse().find((e) => e.status === "delivered");
  const deliveredAt = deliveredEntry?.at ?? null;
  if (!deliveredAt) {
    return { eligible: false, reason: "No delivery date on record", deadline: null, items: [] };
  }
  const deadline = new Date(deliveredAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  if (Date.now() > deadline.getTime()) {
    return { eligible: false, reason: "Return window has closed", deadline, items: [] };
  }

  const alreadyRequested = await ReturnModel.find({
    orderNo: order.orderNo,
    status: { $ne: "rejected" },
  });
  const returnedQtyBySlug = new Map<string, number>();
  for (const ret of alreadyRequested) {
    for (const item of ret.items) {
      returnedQtyBySlug.set(item.productSlug, (returnedQtyBySlug.get(item.productSlug) ?? 0) + item.qty);
    }
  }

  const items = order.items
    .map((item) => ({
      productSlug: item.productSlug,
      name: item.name?.en ?? "",
      qty: item.qty,
      maxQty: item.qty - (returnedQtyBySlug.get(item.productSlug) ?? 0),
    }))
    .filter((item) => item.maxQty > 0);

  if (items.length === 0) {
    return { eligible: false, reason: "All items already returned", deadline, items: [] };
  }
  return { eligible: true, reason: "", deadline, items };
}

export type RequestReturnInput = {
  orderNo: string;
  userId?: string | null;
  items: { productSlug: string; qty: number; reason: string }[];
};

export async function requestReturn(input: RequestReturnInput): Promise<ReturnDoc> {
  const order = await OrderModel.findOne({ orderNo: input.orderNo });
  if (!order) throw notFound("Order");
  if (input.userId && order.userId && String(order.userId) !== input.userId) throw forbidden();
  if (input.items.length === 0) throw badInput("Select at least one item to return");

  const eligibility = await getReturnEligibility(order);
  if (!eligibility.eligible) throw badInput(eligibility.reason);

  const maxQtyBySlug = new Map(eligibility.items.map((i) => [i.productSlug, i.maxQty]));
  const orderItemBySlug = new Map(order.items.map((i) => [i.productSlug, i]));

  for (const line of input.items) {
    const max = maxQtyBySlug.get(line.productSlug);
    if (!max) throw badInput(`${line.productSlug} is not eligible for return`);
    if (line.qty < 1 || line.qty > max) {
      throw badInput(`Quantity for ${line.productSlug} must be between 1 and ${max}`);
    }
    if (!line.reason.trim()) throw badInput("A reason is required for every returned item");
  }

  const ret = await ReturnModel.create({
    returnNo: generateReturnNo(),
    orderNo: order.orderNo,
    userId: order.userId ?? null,
    items: input.items.map((line) => ({
      productSlug: line.productSlug,
      name: orderItemBySlug.get(line.productSlug)!.name,
      qty: line.qty,
      reason: line.reason.trim(),
    })),
    status: "requested",
    timeline: [{ status: "requested", at: new Date(), note: "" }],
  });
  logger.info({ returnNo: ret.returnNo, orderNo: order.orderNo }, "Return requested");
  return ret;
}

export async function listMyReturns(userId: string): Promise<ReturnDoc[]> {
  return ReturnModel.find({ userId }).sort({ createdAt: -1 });
}

export async function getReturn(returnNo: string, userId?: string): Promise<ReturnDoc> {
  const ret = await ReturnModel.findOne({ returnNo });
  if (!ret) throw notFound("Return");
  if (userId && ret.userId && String(ret.userId) !== userId) throw forbidden();
  return ret;
}

export async function cancelReturn(returnNo: string, userId: string): Promise<ReturnDoc> {
  const ret = await getReturn(returnNo, userId);
  return advance(ret, "cancelled", "Cancelled by customer");
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export type AdminReturnFilter = { status?: ReturnStatus | null; search?: string | null };

export async function listReturnsForAdmin(
  filter: AdminReturnFilter,
  skip: number,
  limit: number,
): Promise<{ items: ReturnDoc[]; total: number }> {
  const q: Record<string, unknown> = {};
  if (filter.status) q.status = filter.status;
  if (filter.search?.trim()) {
    const rx = searchRegex(filter.search);
    q.$or = [{ returnNo: rx }, { orderNo: rx }];
  }
  const [items, total] = await Promise.all([
    ReturnModel.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ReturnModel.countDocuments(q),
  ]);
  return { items, total };
}

export async function approveReturn(returnNo: string, note = ""): Promise<ReturnDoc> {
  const ret = await ReturnModel.findOne({ returnNo });
  if (!ret) throw notFound("Return");
  return advance(ret, "approved", note);
}

export async function rejectReturn(returnNo: string, note = ""): Promise<ReturnDoc> {
  const ret = await ReturnModel.findOne({ returnNo });
  if (!ret) throw notFound("Return");
  return advance(ret, "rejected", note || "Rejected by admin");
}

/** Creates the Shiprocket reverse pickup and moves the return to `pickup_scheduled`. */
export async function scheduleReturnPickup(returnNo: string): Promise<ReturnDoc> {
  const ret = await ReturnModel.findOne({ returnNo });
  if (!ret) throw notFound("Return");
  if (ret.status !== "approved") throw badInput("Approve the return before scheduling pickup");

  const order = await OrderModel.findOne({ orderNo: ret.orderNo });
  if (!order) throw notFound("Order");

  const provider = getShippingProvider();
  const shipment = await provider.createReturnShipment({
    returnNo: ret.returnNo,
    order,
    items: ret.items.map((i) => ({ productSlug: i.productSlug, name: i.name?.en ?? "", qty: i.qty })),
  });
  const { pickupScheduledDate } = await provider.schedulePickup(shipment.shipmentId);

  ret.shipment = {
    provider: provider.name,
    providerOrderId: shipment.providerOrderId,
    shipmentId: shipment.shipmentId,
    awbCode: shipment.awbCode,
    courierName: shipment.courierName,
    trackingUrl: shipment.trackingUrl,
    pickupScheduledDate,
    rawStatus: "PICKUP SCHEDULED",
  } as never;
  await ret.save();

  return advance(ret, "pickup_scheduled", `Reverse pickup scheduled — AWB ${shipment.awbCode}`);
}

export async function markReturnReceived(returnNo: string, note = ""): Promise<ReturnDoc> {
  const ret = await ReturnModel.findOne({ returnNo });
  if (!ret) throw notFound("Return");
  return advance(ret, "received", note || "Item received at warehouse");
}

export async function refundReturn(returnNo: string, amount: number): Promise<ReturnDoc> {
  const ret = await ReturnModel.findOne({ returnNo });
  if (!ret) throw notFound("Return");
  if (amount <= 0) throw badInput("Refund amount must be greater than zero");
  ret.refundAmount = amount;
  await ret.save();
  return advance(ret, "refunded", `Refunded ₹${amount}`);
}
