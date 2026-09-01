import { badInput, notFound } from "../../shared/errors.js";
import { ProductModel } from "../catalog/product.model.js";
import { CartModel, PromoModel, type CartDoc } from "./cart.model.js";

/**
 * Totals rules — the authoritative version of `frontend/data/cart.ts`. The
 * frontend keeps a client copy for optimistic display; this is what `placeOrder`
 * trusts.
 */
export const FREE_SHIPPING_THRESHOLD = 2500;
export const FLAT_SHIPPING = 99;

export type CartLineItem = {
  productSlug: string;
  name: { en: string; hi: string };
  image: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
};

export type CartTotals = {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  promoCode: string | null;
};

export type ResolvedCart = {
  id: string;
  items: CartLineItem[];
  totals: CartTotals;
};

export async function resolveCartLines(
  items: { productSlug: string; qty: number }[],
): Promise<CartLineItem[]> {
  if (items.length === 0) return [];
  const slugs = items.map((i) => i.productSlug);
  const products = await ProductModel.find({ slug: { $in: slugs }, status: "active" });
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  return items.flatMap((i) => {
    const p = bySlug.get(i.productSlug);
    if (!p) return [];
    return [
      {
        productSlug: p.slug,
        name: { en: p.name.en, hi: p.name.hi },
        image: p.image,
        unitPrice: p.price,
        qty: i.qty,
        lineTotal: p.price * i.qty,
      },
    ];
  });
}

export async function computeTotals(
  lines: CartLineItem[],
  promoCode: string | null,
): Promise<CartTotals> {
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  let discount = 0;
  let appliedCode: string | null = null;
  if (promoCode) {
    const promo = await PromoModel.findOne({
      code: promoCode.toUpperCase(),
      active: true,
    });
    const valid =
      promo &&
      (!promo.expiresAt || promo.expiresAt.getTime() > Date.now()) &&
      subtotal >= (promo.minSubtotal ?? 0);
    if (valid && subtotal > 0) {
      discount =
        promo.kind === "percent"
          ? Math.round((subtotal * promo.amount) / 100)
          : promo.amount;
      discount = Math.min(discount, subtotal);
      appliedCode = promo.code;
    }
  }

  const afterDiscount = subtotal - discount;
  const shipping =
    afterDiscount <= 0 || afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;

  return { subtotal, discount, shipping, total: afterDiscount + shipping, promoCode: appliedCode };
}

// ─── Cart document access ──────────────────────────────────────────────────

export type CartOwner = { userId?: string; anonId?: string };

export async function getOrCreateCart(owner: CartOwner): Promise<CartDoc> {
  if (!owner.userId && !owner.anonId) {
    throw badInput("A user session or anonId is required for cart operations");
  }
  const query = owner.userId ? { userId: owner.userId } : { anonId: owner.anonId };
  const existing = await CartModel.findOne(query);
  if (existing) return existing;
  return CartModel.create(owner.userId ? { userId: owner.userId } : { anonId: owner.anonId });
}

export async function toResolvedCart(cart: CartDoc): Promise<ResolvedCart> {
  const lines = await resolveCartLines(cart.items);
  // Drop stale items (deleted/archived products) from persistence.
  if (lines.length !== cart.items.length) {
    cart.set(
      "items",
      lines.map((l) => ({ productSlug: l.productSlug, qty: l.qty })),
    );
    await cart.save();
  }
  const totals = await computeTotals(lines, cart.promoCode || null);
  if ((cart.promoCode || "") !== (totals.promoCode || "")) {
    cart.promoCode = totals.promoCode ?? "";
    await cart.save();
  }
  return { id: String(cart._id), items: lines, totals };
}

export async function addItem(owner: CartOwner, productSlug: string, qty: number) {
  const product = await ProductModel.findOne({ slug: productSlug, status: "active" });
  if (!product) throw notFound("Product");
  const cart = await getOrCreateCart(owner);
  const existing = cart.items.find((i) => i.productSlug === productSlug);
  if (existing) existing.qty = Math.min(99, existing.qty + qty);
  else cart.items.push({ productSlug, qty: Math.min(99, Math.max(1, qty)) });
  await cart.save();
  return toResolvedCart(cart);
}

export async function setItemQty(owner: CartOwner, productSlug: string, qty: number) {
  const cart = await getOrCreateCart(owner);
  if (qty <= 0) {
    cart.set("items", cart.items.filter((i) => i.productSlug !== productSlug));
  } else {
    const existing = cart.items.find((i) => i.productSlug === productSlug);
    if (existing) existing.qty = Math.min(99, qty);
    else cart.items.push({ productSlug, qty: Math.min(99, qty) });
  }
  await cart.save();
  return toResolvedCart(cart);
}

export async function removeItem(owner: CartOwner, productSlug: string) {
  const cart = await getOrCreateCart(owner);
  cart.set("items", cart.items.filter((i) => i.productSlug !== productSlug));
  await cart.save();
  return toResolvedCart(cart);
}

export async function applyPromo(owner: CartOwner, code: string) {
  const promo = await PromoModel.findOne({ code: code.toUpperCase(), active: true });
  if (!promo) throw badInput("That code isn't recognised");
  const cart = await getOrCreateCart(owner);
  cart.promoCode = promo.code;
  await cart.save();
  return toResolvedCart(cart);
}

export async function clearPromo(owner: CartOwner) {
  const cart = await getOrCreateCart(owner);
  cart.promoCode = "";
  await cart.save();
  return toResolvedCart(cart);
}

export async function clearCart(owner: CartOwner) {
  const cart = await getOrCreateCart(owner);
  cart.set("items", []);
  cart.promoCode = "";
  await cart.save();
  return toResolvedCart(cart);
}
