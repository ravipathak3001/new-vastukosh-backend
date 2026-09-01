import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";

const cartItemSchema = new Schema(
  {
    productSlug: { type: String, required: true },
    qty: { type: Number, required: true, min: 1, max: 99 },
  },
  { _id: false },
);

/**
 * One cart per identity. Signed-in users key on `userId`; guests key on an
 * `anonId` (a random id the client stores). `mergeGuestCart` folds the latter
 * into the former on login.
 */
const cartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true, sparse: true, unique: true },
    anonId: { type: String, index: true, sparse: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
    promoCode: { type: String, default: "" },
  },
  { timestamps: true },
);

export type Cart = InferSchemaType<typeof cartSchema>;
export type CartDoc = HydratedDocument<Cart>;
export const CartModel = defineModel("Cart", cartSchema);

const promoSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    kind: { type: String, enum: ["percent", "flat"], required: true },
    amount: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
    minSubtotal: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type Promo = InferSchemaType<typeof promoSchema>;
export type PromoDoc = HydratedDocument<Promo>;
export const PromoModel = defineModel("Promo", promoSchema);
