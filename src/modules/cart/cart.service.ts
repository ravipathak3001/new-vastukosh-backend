import { badInput, notFound } from "../../shared/errors.js";
import { env } from "../../config/env.js";
import { ProductModel } from "../catalog/product.model.js";
import { priceSegments, getStonesBySlug } from "../catalog/stone.service.js";
import {
  isCustomBraceletSlug,
  parseCustomBraceletSlug,
  customBraceletImageUrl,
} from "../catalog/custom-bracelet.js";
import {
  CartModel,
  PromoModel,
  type CartDoc,
  type PromoDoc,
} from "./cart.model.js";

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

/**
 * A picker-built combo bracelet's line: priced fresh from its segments' current stone prices (never
 * trust the price the client remembers), named from those stones, pictured with the same bracelet
 * the customer actually configured. Null when the slug is malformed or a segment's stone has gone
 * inactive/vanished since it was added — dropped silently, the same as a deleted product elsewhere
 * in this file.
 */
async function resolveCustomBraceletLine(productSlug: string, qty: number): Promise<CartLineItem | null> {
  const segments = parseCustomBraceletSlug(productSlug);
  if (!segments) return null;

  let unitPrice: number;
  try {
    unitPrice = await priceSegments(segments);
  } catch {
    return null;
  }

  const stones = await getStonesBySlug(segments.map((s) => s.stoneSlug));
  const nameIn = (locale: "en" | "hi") =>
    segments.map((s) => stones.get(s.stoneSlug)?.name[locale] ?? s.stoneSlug).join(", ");

  return {
    productSlug,
    name: { en: `Custom Bracelet (${nameIn("en")})`, hi: `कस्टम ब्रेसलेट (${nameIn("hi")})` },
    image: customBraceletImageUrl(env.SITE_URL, segments),
    unitPrice,
    qty,
    lineTotal: unitPrice * qty,
  };
}

export async function resolveCartLines(
  items: { productSlug: string; qty: number }[],
): Promise<CartLineItem[]> {
  if (items.length === 0) return [];

  const productSlugs = items.filter((i) => !isCustomBraceletSlug(i.productSlug)).map((i) => i.productSlug);
  const products = productSlugs.length
    ? await ProductModel.find({ slug: { $in: productSlugs }, status: "active" })
    : [];
  const productBySlug = new Map(products.map((p) => [p.slug, p]));

  const lines = await Promise.all(
    items.map(async (i): Promise<CartLineItem | null> => {
      if (isCustomBraceletSlug(i.productSlug)) return resolveCustomBraceletLine(i.productSlug, i.qty);
      const p = productBySlug.get(i.productSlug);
      if (!p) return null;
      return {
        productSlug: p.slug,
        name: { en: p.name.en, hi: p.name.hi },
        image: p.image,
        unitPrice: p.price,
        qty: i.qty,
        lineTotal: p.price * i.qty,
      };
    }),
  );
  return lines.filter((l): l is CartLineItem => l !== null);
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

/** Throws if the design is malformed or any segment's stone is unknown/inactive/wrong-graha — see `priceSegments`. Return value (the price) is discarded here; `toResolvedCart` computes the authoritative one fresh right after. */
async function assertValidCustomBracelet(productSlug: string): Promise<void> {
  const segments = parseCustomBraceletSlug(productSlug);
  if (!segments) throw badInput("That bracelet design isn't valid");
  await priceSegments(segments);
}

export async function addItem(owner: CartOwner, productSlug: string, qty: number) {
  const cart = await getOrCreateCart(owner);
  const existing = cart.items.find((i) => i.productSlug === productSlug);

  if (isCustomBraceletSlug(productSlug)) {
    await assertValidCustomBracelet(productSlug);
    // Not stock-tracked — made to order from loose stones, so no product-quantity cap here.
    const nextQty = Math.min(99, (existing?.qty ?? 0) + qty);
    if (existing) existing.qty = nextQty;
    else cart.items.push({ productSlug, qty: Math.max(1, nextQty) });
  } else {
    const product = await ProductModel.findOne({ slug: productSlug, status: "active" });
    if (!product) throw notFound("Product");
    if (product.stockQty <= 0) throw badInput("This item is out of stock");
    const nextQty = Math.min(99, product.stockQty, (existing?.qty ?? 0) + qty);
    if (existing) existing.qty = nextQty;
    else cart.items.push({ productSlug, qty: Math.max(1, nextQty) });
  }
  await cart.save();
  return toResolvedCart(cart);
}

export async function setItemQty(owner: CartOwner, productSlug: string, qty: number) {
  const cart = await getOrCreateCart(owner);
  if (qty <= 0) {
    cart.set("items", cart.items.filter((i) => i.productSlug !== productSlug));
  } else if (isCustomBraceletSlug(productSlug)) {
    await assertValidCustomBracelet(productSlug);
    const cappedQty = Math.min(99, qty);
    const existing = cart.items.find((i) => i.productSlug === productSlug);
    if (existing) existing.qty = cappedQty;
    else cart.items.push({ productSlug, qty: cappedQty });
  } else {
    const product = await ProductModel.findOne({ slug: productSlug, status: "active" });
    if (!product) throw notFound("Product");
    if (product.stockQty <= 0) throw badInput("This item is out of stock");
    const cappedQty = Math.min(99, qty, product.stockQty);
    const existing = cart.items.find((i) => i.productSlug === productSlug);
    if (existing) existing.qty = cappedQty;
    else cart.items.push({ productSlug, qty: cappedQty });
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

// ─── Admin: promo codes ──────────────────────────────────────────────────

export async function listPromosForAdmin(): Promise<PromoDoc[]> {
  return PromoModel.find().sort({ createdAt: -1 });
}

export async function upsertPromo(
  input: { code: string } & Record<string, unknown>,
): Promise<PromoDoc> {
  const code = input.code.toUpperCase();
  return PromoModel.findOneAndUpdate(
    { code },
    { $set: { ...input, code } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

export async function deletePromo(code: string): Promise<{ code: string }> {
  const doc = await PromoModel.findOneAndDelete({ code: code.toUpperCase() });
  if (!doc) throw notFound("Promo code");
  return { code };
}
