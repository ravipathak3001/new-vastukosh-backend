import { ProductModel } from "../catalog/product.model.js";

/** What the carrier is told about the parcel: cm and kg, as Shiprocket expects. */
export type Parcel = {
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  weightKg: number;
  /** Order lines whose product had no packed size/weight, so the default unit was used. */
  estimated: string[];
};

export type PackedUnit = {
  weightGrams?: number | null;
  lengthCm?: number | null;
  breadthCm?: number | null;
  heightCm?: number | null;
};

/** Stand-in for a product without shipping details — the parcel every order used before. */
export const DEFAULT_UNIT = { weightGrams: 500, lengthCm: 15, breadthCm: 10, heightCm: 10 } as const;

const positive = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Combines the order's lines into one parcel: weights add up, boxes are laid
 * flat and stacked (longest side → length, shortest → height). That's a
 * conservative over-estimate of a real pack, which is what carriers prefer to
 * an under-declared one. A line missing its weight or any dimension uses
 * `DEFAULT_UNIT` for all of them and is reported in `estimated`.
 */
export function combineParcel(lines: { slug: string; qty: number; unit: PackedUnit | null }[]): Parcel {
  let length = 0;
  let breadth = 0;
  let height = 0;
  let grams = 0;
  const estimated: string[] = [];

  for (const { slug, qty, unit } of lines) {
    if (qty <= 0) continue;
    const complete =
      unit &&
      positive(unit.weightGrams) &&
      positive(unit.lengthCm) &&
      positive(unit.breadthCm) &&
      positive(unit.heightCm);
    const u = complete ? (unit as Required<{ [K in keyof PackedUnit]: number }>) : DEFAULT_UNIT;
    if (!complete) estimated.push(slug);

    const [l, b, h] = [u.lengthCm, u.breadthCm, u.heightCm].sort((x, y) => y - x) as [number, number, number];
    length = Math.max(length, l);
    breadth = Math.max(breadth, b);
    height += h * qty;
    grams += u.weightGrams * qty;
  }

  if (grams === 0) {
    return { ...toParcel(DEFAULT_UNIT), estimated };
  }
  return {
    lengthCm: round1(Math.max(length, 0.5)),
    breadthCm: round1(Math.max(breadth, 0.5)),
    heightCm: round1(Math.max(height, 0.5)),
    // Carriers bill in 500 g slabs anyway; never declare less than 50 g.
    weightKg: Math.max(Math.round(grams) / 1000, 0.05),
    estimated,
  };
}

function toParcel(u: typeof DEFAULT_UNIT): Omit<Parcel, "estimated"> {
  return { lengthCm: u.lengthCm, breadthCm: u.breadthCm, heightCm: u.heightCm, weightKg: u.weightGrams / 1000 };
}

/** Looks up each line's product (current catalog values, so fixes made after ordering apply). */
export async function parcelForOrder(items: { productSlug: string; qty: number }[]): Promise<Parcel> {
  const slugs = [...new Set(items.map((i) => i.productSlug))];
  const products = await ProductModel.find(
    { slug: { $in: slugs } },
    { slug: 1, weightGrams: 1, lengthCm: 1, breadthCm: 1, heightCm: 1 },
  ).lean();
  const bySlug = new Map(products.map((p) => [p.slug, p as PackedUnit]));
  return combineParcel(
    items.map((i) => ({ slug: i.productSlug, qty: i.qty, unit: bySlug.get(i.productSlug) ?? null })),
  );
}
