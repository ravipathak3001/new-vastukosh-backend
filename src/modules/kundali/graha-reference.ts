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

type NaturalTier = "friend" | "neutral" | "enemy";
type ClassicalGraha = "Sun" | "Moon" | "Mars" | "Mercury" | "Jupiter" | "Venus" | "Saturn";

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
