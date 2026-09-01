import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import { badInput } from "../../shared/errors.js";
import type { Context } from "../../graphql/context.js";
import {
  addItem,
  applyPromo,
  clearPromo,
  getOrCreateCart,
  removeItem,
  setItemQty,
  toResolvedCart,
  type CartLineItem,
  type CartTotals,
  type ResolvedCart,
} from "./cart.service.js";

const CartLineItemRef = builder.objectRef<CartLineItem>("CartLineItem").implement({
  fields: (t) => ({
    productSlug: t.exposeString("productSlug"),
    name: t.field({ type: LocalizedStringRef, resolve: (l) => l.name }),
    image: t.exposeString("image"),
    unitPrice: t.exposeFloat("unitPrice"),
    qty: t.exposeInt("qty"),
    lineTotal: t.exposeFloat("lineTotal"),
  }),
});

const CartTotalsRef = builder.objectRef<CartTotals>("CartTotals").implement({
  fields: (t) => ({
    subtotal: t.exposeFloat("subtotal"),
    discount: t.exposeFloat("discount"),
    shipping: t.exposeFloat("shipping"),
    total: t.exposeFloat("total"),
    promoCode: t.exposeString("promoCode", { nullable: true }),
  }),
});

const CartRef = builder.objectRef<ResolvedCart>("Cart").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    items: t.field({ type: [CartLineItemRef], resolve: (c) => c.items }),
    totals: t.field({ type: CartTotalsRef, resolve: (c) => c.totals }),
    itemCount: t.int({
      resolve: (c) => c.items.reduce<number>((n, i) => n + i.qty, 0),
    }),
  }),
});

/** Signed-in users key on their id; guests must pass the `anonId` they persist. */
function ownerFrom(ctx: Context, anonId?: string | null) {
  if (ctx.user) return { userId: ctx.user.id };
  if (anonId) return { anonId };
  throw badInput("Sign in or provide an anonId to use the cart");
}

export function registerCartModule() {
  builder.queryFields((t) => ({
    cart: t.field({
      type: CartRef,
      args: { anonId: t.arg.string({ required: false }) },
      resolve: async (_p, { anonId }, ctx) => {
        const cart = await getOrCreateCart(ownerFrom(ctx, anonId));
        return toResolvedCart(cart);
      },
    }),
  }));

  builder.mutationFields((t) => ({
    addToCart: t.field({
      type: CartRef,
      args: {
        productSlug: t.arg.string({ required: true }),
        qty: t.arg.int({ required: false }),
        anonId: t.arg.string({ required: false }),
      },
      resolve: (_p, { productSlug, qty, anonId }, ctx) =>
        addItem(ownerFrom(ctx, anonId), productSlug, qty ?? 1),
    }),
    setCartItemQty: t.field({
      type: CartRef,
      args: {
        productSlug: t.arg.string({ required: true }),
        qty: t.arg.int({ required: true }),
        anonId: t.arg.string({ required: false }),
      },
      resolve: (_p, { productSlug, qty, anonId }, ctx) =>
        setItemQty(ownerFrom(ctx, anonId), productSlug, qty),
    }),
    removeFromCart: t.field({
      type: CartRef,
      args: {
        productSlug: t.arg.string({ required: true }),
        anonId: t.arg.string({ required: false }),
      },
      resolve: (_p, { productSlug, anonId }, ctx) =>
        removeItem(ownerFrom(ctx, anonId), productSlug),
    }),
    applyPromo: t.field({
      type: CartRef,
      args: {
        code: t.arg.string({ required: true }),
        anonId: t.arg.string({ required: false }),
      },
      resolve: (_p, { code, anonId }, ctx) => applyPromo(ownerFrom(ctx, anonId), code),
    }),
    clearPromo: t.field({
      type: CartRef,
      args: { anonId: t.arg.string({ required: false }) },
      resolve: (_p, { anonId }, ctx) => clearPromo(ownerFrom(ctx, anonId)),
    }),
  }));
}
