import type { GrahaName } from "vedic-kundali";
import { STONE_GRAHAS } from "./stone.model.js";

/**
 * A picker-built combination bracelet has no product row — its price depends on which stone was
 * chosen per segment, computed fresh each time (see `stone.service.ts`'s `priceSegments`), not
 * looked up. Rather than inventing a second cart/order line-item shape for it, it travels as a
 * "virtual" product slug carrying its own design, the same way the *image* URL already does (see
 * `frontend/lib/bracelet/design.ts`'s `formatDesign`) — just with an explicit stone on every segment,
 * since a cart line can't fall back to "whichever gem is traditional" the way a picker default can.
 *
 *   custom:Mars:carnelian:9,Jupiter:citrine:7,Sun:ruby:5
 *
 * `cart.service.ts` recognises this prefix and prices/names the line accordingly instead of looking
 * up a `Product`; `catalog.service.ts`'s stock reservation skips it entirely — a custom bracelet is
 * made to order from loose stones, not drawn from finished-bracelet inventory.
 */
const PREFIX = "custom:";

export type CustomBraceletSegment = { graha: GrahaName; stoneSlug: string; beads: number };

export function isCustomBraceletSlug(slug: string): boolean {
  return slug.startsWith(PREFIX);
}

export function formatCustomBraceletSlug(segments: readonly CustomBraceletSegment[]): string {
  return PREFIX + segments.map((s) => `${s.graha}:${s.stoneSlug}:${s.beads}`).join(",");
}

/** Inverse of `formatCustomBraceletSlug`; null unless every segment names a known graha, a stone slug, and a positive bead count. */
export function parseCustomBraceletSlug(slug: string): CustomBraceletSegment[] | null {
  if (!isCustomBraceletSlug(slug)) return null;
  const raw = slug.slice(PREFIX.length);
  if (!raw) return null;

  const segments: CustomBraceletSegment[] = [];
  for (const part of raw.split(",")) {
    const [graha, stoneSlug, beadsRaw] = part.split(":");
    const beads = Number(beadsRaw);
    if (!graha || !stoneSlug || !Number.isInteger(beads) || beads < 1) return null;
    if (!(STONE_GRAHAS as readonly string[]).includes(graha)) return null;
    segments.push({ graha: graha as GrahaName, stoneSlug, beads });
  }
  return segments.length > 0 ? segments : null;
}

/** A short, real (if not photographically real) picture of this exact bracelet, for the cart/order line. */
export function customBraceletImageUrl(siteUrl: string, segments: readonly CustomBraceletSegment[]): string {
  const design = segments.map((s) => `${s.graha}:${s.stoneSlug}:${s.beads}`).join(",");
  return `${siteUrl}/api/bracelet/combo.jpg?d=${encodeURIComponent(design)}&size=400`;
}
