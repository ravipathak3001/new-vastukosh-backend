import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";
import { addressSchema } from "../auth/auth.model.js";

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "consecration",
  "packed",
  "in_transit",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ["upi", "card", "netbanking", "cod"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["created", "authorized", "captured", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Raw carrier status strings recorded verbatim; not an enum since providers vary. */
const shipmentStatusHistoryEntrySchema = new Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const orderShipmentSchema = new Schema(
  {
    provider: { type: String, required: true },
    providerOrderId: { type: String, default: "" },
    shipmentId: { type: String, default: "" },
    awbCode: { type: String, default: "" },
    courierId: { type: String, default: "" },
    courierName: { type: String, default: "" },
    trackingUrl: { type: String, default: "" },
    labelUrl: { type: String, default: "" },
    invoiceUrl: { type: String, default: "" },
    pickupScheduledDate: { type: Date, default: null },
    expectedDeliveryDate: { type: Date, default: null },
    rawStatus: { type: String, default: "" },
    statusHistory: { type: [shipmentStatusHistoryEntrySchema], default: [] },
    cancelledAt: { type: Date, default: null },
  },
  { _id: false },
);

const orderItemSchema = new Schema(
  {
    productSlug: { type: String, required: true },
    name: { en: { type: String, required: true }, hi: { type: String, required: true } },
    image: { type: String, default: "" },
    unitPrice: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const timelineEntrySchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, required: true, default: () => new Date() },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const orderPaymentSchema = new Schema(
  {
    provider: { type: String, required: true },
    providerRef: { type: String, default: "" },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: "created" },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNo: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true, default: null },
    email: { type: String, required: true, lowercase: true, trim: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, enum: ["INR"], default: "INR" },
    promoCode: { type: String, default: "" },
    shippingAddress: { type: addressSchema, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: "pending_payment", index: true },
    payment: { type: orderPaymentSchema, required: true },
    timeline: { type: [timelineEntrySchema], default: [] },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    shipment: { type: orderShipmentSchema, default: null },
  },
  { timestamps: true },
);

export type Order = InferSchemaType<typeof orderSchema>;
export type OrderDoc = HydratedDocument<Order>;
export const OrderModel = defineModel("Order", orderSchema);
