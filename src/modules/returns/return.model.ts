import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";

export const RETURN_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "pickup_scheduled",
  "received",
  "refunded",
  "cancelled",
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

const returnItemSchema = new Schema(
  {
    productSlug: { type: String, required: true },
    name: { en: { type: String, required: true }, hi: { type: String, required: true } },
    qty: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const returnTimelineEntrySchema = new Schema(
  {
    status: { type: String, enum: RETURN_STATUSES, required: true },
    at: { type: Date, required: true, default: () => new Date() },
    note: { type: String, default: "" },
  },
  { _id: false },
);

/** Mirrors `order.shipment` — the reverse-pickup shipment Shiprocket creates for an approved return. */
const returnShipmentSchema = new Schema(
  {
    provider: { type: String, required: true },
    providerOrderId: { type: String, default: "" },
    shipmentId: { type: String, default: "" },
    awbCode: { type: String, default: "" },
    courierName: { type: String, default: "" },
    trackingUrl: { type: String, default: "" },
    pickupScheduledDate: { type: Date, default: null },
    rawStatus: { type: String, default: "" },
  },
  { _id: false },
);

const returnSchema = new Schema(
  {
    returnNo: { type: String, required: true, unique: true, index: true },
    orderNo: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true, default: null },
    items: { type: [returnItemSchema], required: true },
    status: { type: String, enum: RETURN_STATUSES, default: "requested", index: true },
    refundAmount: { type: Number, default: 0 },
    adminNote: { type: String, default: "" },
    shipment: { type: returnShipmentSchema, default: null },
    timeline: { type: [returnTimelineEntrySchema], default: [] },
  },
  { timestamps: true },
);

export type Return = InferSchemaType<typeof returnSchema>;
export type ReturnDoc = HydratedDocument<Return>;
export const ReturnModel = defineModel("Return", returnSchema);
