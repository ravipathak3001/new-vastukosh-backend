import type { FilterQuery } from "mongoose";
import type { GrahaName } from "vedic-kundali";
import { badInput, notFound } from "../../shared/errors.js";
import { searchRegex } from "../../graphql/admin-common.js";
import { StoneModel, type Stone, type StoneDoc, type StoneStatus } from "./stone.model.js";

export type StoneFilter = { graha?: GrahaName; search?: string };

function toQuery(filter: StoneFilter = {}, statusFilter: FilterQuery<Stone>): FilterQuery<Stone> {
  const q: FilterQuery<Stone> = { ...statusFilter };
  if (filter.graha) q.grahas = filter.graha;
  if (filter.search?.trim()) {
    const rx = searchRegex(filter.search);
    q.$or = [{ slug: rx }, { "name.en": rx }, { "name.hi": rx }];
  }
  return q;
}

// ─── Public reads ───────────────────────────────────────────────────────────

export async function listStones(filter: StoneFilter = {}): Promise<StoneDoc[]> {
  return StoneModel.find(toQuery(filter, { status: "active" })).sort({ primary: -1, pricePerBead: 1 });
}

/** Active stones by slug, for display (e.g. a custom bracelet's cart-line name) rather than pricing — see `priceSegments` for the authoritative, validating lookup. */
export async function getStonesBySlug(slugs: readonly string[]): Promise<Map<string, StoneDoc>> {
  if (slugs.length === 0) return new Map();
  const stones = await StoneModel.find({ slug: { $in: [...new Set(slugs)] }, status: "active" });
  return new Map(stones.map((s) => [s.slug, s]));
}

export async function getStoneBySlug(slug: string): Promise<StoneDoc> {
  const doc = await StoneModel.findOne({ slug, status: "active" });
  if (!doc) throw notFound("Stone");
  return doc;
}

/**
 * A combination bracelet's price, computed rather than looked up: each segment names how many beads
 * it has and which stone it uses, and the total is the sum of `beads × that stone's pricePerBead`,
 * plus `baseFee` (consecration/craftsmanship, flat regardless of which stones were picked). Always
 * prices from the *current* DB rows — never trust a client-supplied price. Throws if any segment
 * names a stone that doesn't exist, isn't active, or doesn't actually serve that segment's graha.
 */
export async function priceSegments(
  segments: readonly { graha: GrahaName; stoneSlug: string; beads: number }[],
  baseFee = 0,
): Promise<number> {
  if (segments.length === 0) throw badInput("A bracelet needs at least one segment");
  const slugs = [...new Set(segments.map((s) => s.stoneSlug))];
  const stones = await StoneModel.find({ slug: { $in: slugs }, status: "active" });
  const bySlug = new Map(stones.map((s) => [s.slug, s]));

  let total = baseFee;
  for (const seg of segments) {
    const stone = bySlug.get(seg.stoneSlug);
    if (!stone) throw badInput(`Unknown or inactive stone: ${seg.stoneSlug}`);
    if (!stone.grahas.includes(seg.graha)) {
      throw badInput(`${seg.stoneSlug} isn't offered for ${seg.graha}`);
    }
    if (seg.beads < 1) throw badInput(`${seg.graha} needs at least one bead`);
    total += seg.beads * stone.pricePerBead;
  }
  return total;
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export type AdminStoneFilter = StoneFilter & { status?: StoneStatus | null };

export async function listStonesForAdmin(
  filter: AdminStoneFilter,
  skip: number,
  limit: number,
): Promise<{ items: StoneDoc[]; total: number }> {
  const q = toQuery(filter, filter.status ? { status: filter.status } : {});
  const [items, total] = await Promise.all([
    StoneModel.find(q).sort({ primary: -1, slug: 1 }).skip(skip).limit(limit),
    StoneModel.countDocuments(q),
  ]);
  return { items, total };
}

export async function getStoneForAdmin(slug: string): Promise<StoneDoc> {
  const doc = await StoneModel.findOne({ slug });
  if (!doc) throw notFound("Stone");
  return doc;
}

export async function upsertStone(input: Partial<Stone> & { slug: string }): Promise<StoneDoc> {
  return StoneModel.findOneAndUpdate(
    { slug: input.slug },
    { $set: input },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

export async function setStoneStatus(slug: string, status: StoneStatus): Promise<StoneDoc> {
  const doc = await StoneModel.findOneAndUpdate({ slug }, { $set: { status } }, { new: true });
  if (!doc) throw notFound("Stone");
  return doc;
}

export async function archiveStone(slug: string): Promise<StoneDoc> {
  return setStoneStatus(slug, "archived");
}
