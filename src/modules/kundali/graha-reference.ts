import type { GrahaName } from "vedic-kundali";
import type { LocalizedString } from "../../shared/localized.js";

/**
 * Static classical reference data `vedic-kundali` doesn't compute itself —
 * sign rulership, natural (Naisargika) planetary friendship, and the
 * Navaratna gemstone each graha is classically associated with.
 */

/** Rāśi (1 Meṣa – 12 Meena) → its ruling graha. */
export const RASHI_LORDS: Record<number, GrahaName> = {
  1: "Mars",
  2: "Venus",
  3: "Mercury",
  4: "Moon",
  5: "Sun",
  6: "Mercury",
  7: "Venus",
  8: "Mars",
  9: "Jupiter",
  10: "Saturn",
  11: "Saturn",
  12: "Jupiter",
};

export function rashiLord(rashi: number): GrahaName {
  const lord = RASHI_LORDS[rashi];
  if (!lord) throw new Error(`No rashi lord defined for rashi ${rashi}`);
  return lord;
}

/** Rāśis a graha rules. Rāhu/Ketu rule none — they're shadow points, not physical grahas. */
export function rashisRuledBy(graha: GrahaName): number[] {
  return Object.entries(RASHI_LORDS)
    .filter(([, lord]) => lord === graha)
    .map(([rashi]) => Number(rashi));
}

type NaturalTier = "friend" | "neutral" | "enemy";
export type ClassicalGraha = "Sun" | "Moon" | "Mars" | "Mercury" | "Jupiter" | "Venus" | "Saturn";

/**
 * Naisargika (natural) friendship, from Bṛhat Parāśara Horā Śāstra — fixed
 * per graha, independent of any individual chart. Only defined for the seven
 * classical grahas (asymmetric: e.g. Sun treats Mercury as neutral, but
 * Mercury treats Sun as a friend — that's the classical table, not a bug).
 * Rāhu/Ketu have no BPHS entry of their own, since they're shadow points
 * rather than physical grahas — by the common convention most Vedic software
 * follows, Rāhu is treated as Saturn's proxy and Ketu as Mars's, on both
 * sides of every lookup below.
 */
const NATURAL_FRIENDSHIP_7: Record<
  ClassicalGraha,
  { friends: ClassicalGraha[]; enemies: ClassicalGraha[] }
> = {
  Sun: { friends: ["Moon", "Mars", "Jupiter"], enemies: ["Venus", "Saturn"] },
  Moon: { friends: ["Sun", "Mercury"], enemies: [] },
  Mars: { friends: ["Sun", "Moon", "Jupiter"], enemies: ["Mercury"] },
  Mercury: { friends: ["Sun", "Venus"], enemies: ["Moon"] },
  Jupiter: { friends: ["Sun", "Moon", "Mars"], enemies: ["Mercury", "Venus"] },
  Venus: { friends: ["Mercury", "Saturn"], enemies: ["Sun", "Moon"] },
  Saturn: { friends: ["Mercury", "Venus"], enemies: ["Sun", "Moon", "Mars"] },
};

const SHADOW_PROXY: Record<"Rahu" | "Ketu", ClassicalGraha> = { Rahu: "Saturn", Ketu: "Mars" };

function classical(g: GrahaName): ClassicalGraha {
  return g === "Rahu" || g === "Ketu" ? SHADOW_PROXY[g] : g;
}

/** How `reference` naturally regards `target`. Callers exclude `reference === target`. */
export function naturalRelation(reference: GrahaName, target: GrahaName): NaturalTier {
  const row = NATURAL_FRIENDSHIP_7[classical(reference)];
  const t = classical(target);
  if (row.friends.includes(t)) return "friend";
  if (row.enemies.includes(t)) return "enemy";
  return "neutral";
}

export type FunctionalNature = "FRIEND" | "NEUTRAL" | "ENEMY";

const TRIKONA_HOUSES: ReadonlySet<number> = new Set([1, 5, 9]);
const DUSTHANA_HOUSES: ReadonlySet<number> = new Set([6, 8, 12]);

/** House (1–12, counted from the lagna) that `rashi` falls in, for a chart whose lagna sits in `lagnaRashi`. */
function houseOfRashi(lagnaRashi: number, rashi: number): number {
  return ((rashi - lagnaRashi + 12) % 12) + 1;
}

/**
 * Combines both directions of the (asymmetric) Naisargika table into one verdict — either
 * side regarding the other as an enemy is decisive, which is how popular functional-nature
 * reasoning treats "natural enemies" even though BPHS itself is one-directional.
 */
function symmetricNaturalRelation(a: ClassicalGraha, b: ClassicalGraha): NaturalTier {
  const ab = naturalRelation(a, b);
  const ba = naturalRelation(b, a);
  if (ab === "enemy" || ba === "enemy") return "enemy";
  if (ab === "friend" || ba === "friend") return "friend";
  return "neutral";
}

/**
 * Functional benefic/malefic/neutral nature of `graha` for a chart with this `lagnaRashi` —
 * the fixed, ascendant-only system used for gemstone recommendations (distinct from Pañchadhā
 * Maitri, which is chart-placement-dependent). Rules, in priority order:
 *  1. The Lagna (1st house) lord is always FRIEND, even if it also owns a dusthana.
 *  2. Otherwise, owning any dusthana house (6th/8th/12th) makes it ENEMY.
 *  3. Otherwise, owning a trikona house (5th/9th) makes it FRIEND.
 *  4. Otherwise (only kendra/upachaya/maraka houses, or none at all) fall back to the
 *     symmetric natural relationship with the Lagna lord.
 * Rāhu/Ketu own no house — use `rahuKetuFunctionalNature` for them instead.
 */
export function functionalNature(graha: ClassicalGraha, lagnaRashi: number): FunctionalNature {
  const lagnaLord = rashiLord(lagnaRashi);
  if (graha === lagnaLord) return "FRIEND";

  const ownedHouses = rashisRuledBy(graha).map((rashi) => houseOfRashi(lagnaRashi, rashi));
  if (ownedHouses.some((h) => DUSTHANA_HOUSES.has(h))) return "ENEMY";
  if (ownedHouses.some((h) => TRIKONA_HOUSES.has(h))) return "FRIEND";

  const tier = symmetricNaturalRelation(classical(lagnaLord), graha);
  return tier === "friend" ? "FRIEND" : tier === "enemy" ? "ENEMY" : "NEUTRAL";
}

/**
 * Rāhu/Ketu rule no house of their own, so they inherit the functional nature of whichever
 * graha rules the rāśi they occupy in this specific chart (`occupiedRashi`) — chart-specific,
 * unlike the fixed per-ascendant nature of the seven classical grahas.
 */
export function rahuKetuFunctionalNature(occupiedRashi: number, lagnaRashi: number): FunctionalNature {
  return functionalNature(classical(rashiLord(occupiedRashi)), lagnaRashi);
}

/** Navaratna gemstone conventionally associated with each graha. */
export const GEMSTONE_BY_GRAHA: Record<GrahaName, LocalizedString> = {
  Sun: { en: "Ruby (Manikya)", hi: "माणिक्य (रूबी)" },
  Moon: { en: "Pearl (Moti)", hi: "मोती" },
  Mars: { en: "Red Coral (Moonga)", hi: "मूंगा" },
  Mercury: { en: "Emerald (Panna)", hi: "पन्ना" },
  Jupiter: { en: "Yellow Sapphire (Pukhraj)", hi: "पुखराज" },
  Venus: { en: "Diamond (Heera)", hi: "हीरा" },
  Saturn: { en: "Blue Sapphire (Neelam)", hi: "नीलम" },
  Rahu: { en: "Hessonite (Gomed)", hi: "गोमेद" },
  Ketu: { en: "Cat's Eye (Lehsunia)", hi: "लहसुनिया" },
};
