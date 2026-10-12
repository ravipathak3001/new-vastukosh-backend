import type { OrderDoc, OrderStatus } from "./order.model.js";
import { queueAdminEmail, queueEmail } from "../email/outbox.service.js";
import {
  adminNewOrderTemplate,
  orderCancelledTemplate,
  orderConfirmedTemplate,
  orderDeliveredTemplate,
  orderRefundedTemplate,
  orderShippedTemplate,
} from "../email/templates/order.js";

const TEMPLATES: Partial<Record<OrderStatus, (o: OrderDoc) => ReturnType<typeof orderConfirmedTemplate>>> = {
  // `consecration` is where every paid / COD order lands — the "confirmed" moment.
  consecration: orderConfirmedTemplate,
  in_transit: orderShippedTemplate,
  delivered: orderDeliveredTemplate,
  cancelled: orderCancelledTemplate,
  refunded: orderRefundedTemplate,
};

/**
 * Emails the customer (and, for new orders, the team) when an order reaches
 * a status they should hear about. Keyed per order + status, so a webhook and
 * the browser confirming the same payment still send one email.
 */
export async function notifyOrderStatus(order: OrderDoc, status: OrderStatus): Promise<void> {
  const template = TEMPLATES[status];
  if (!template) return;
  await queueEmail({
    to: order.email,
    kind: `order.${status}`,
    ref: order.orderNo,
    dedupeKey: `order:${order.orderNo}:${status}`,
    ...template(order),
  });
  if (status === "consecration") {
    await queueAdminEmail({
      kind: "admin.new_order",
      ref: order.orderNo,
      dedupeKey: `admin:order:${order.orderNo}`,
      ...adminNewOrderTemplate(order),
    });
  }
}
