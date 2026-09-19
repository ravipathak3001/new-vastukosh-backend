import {
  generateKundali,
  vimshottariDasha,
  activeDashaChain,
  ascendantTropicalLongitude,
  rashiPlacement,
  wholeSignHouses,
  GRAHA_ORDER,
  GRAHA_NAMES,
  type Kundali,
  type GrahaName,
  type Bhava,
} from "vedic-kundali";
import { dateToJD, type AyanamsaSystem, type Name } from "vedic-panchanga";
import { badInput } from "../../shared/errors.js";
import type { LocalizedString } from "../../shared/localized.js";
import { rashiLord, naturalRelation, GEMSTONE_BY_GRAHA } from "./graha-reference.js";

/**
 * Thin wrapper over `vedic-kundali`: generates the birth chart + current
 * Vimśottarī Mahādaśā, then works out — relative to *both* the Ascendant
 * (Lagna) lord and the running Mahādaśā lord — which grahas are
 * astrologically favorable vs. ones to approach with caution, via the
 * classical Pañchadhā (compound) friendship: Naisargika (natural, fixed)
 * friendship combined with Tātkālika (temporal, chart-specific) friendship
 * derived from each graha's house position in this exact chart.
 *
 * Unlike the `panchang` module, this does NOT memoize: panchang's cache key
 * space is small (most requests share "today + default location"), but a
 * kundali's key is unique per shopper's birth data — an unbounded in-process
 * Map would leak. `generateKundali` is a fast synchronous computation, so
 * recomputing per request is fine.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WALL_TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

type NameLike = { iast: string; devanagari: string };
const localized = (n: NameLike | Name): LocalizedString => ({ en: n.iast, hi: n.devanagari });

export type CompoundRelation =
  | "GREAT_FRIEND"
  | "FRIEND"
  | "NEUTRAL"
  | "ENEMY"
  | "GREAT_ENEMY"
  | "SELF";

function temporalRelation(houses: Bhava[], reference: GrahaName, target: GrahaName): "friend" | "enemy" {
  const refHouse = houseOf(houses, reference);
  const targetHouse = houseOf(houses, target);
  // Houses counted from `reference`'s own house as 1 (classical Tātkālika reckoning).
  const distance = ((targetHouse - refHouse + 12) % 12) + 1;
  return [2, 3, 4, 10, 11, 12].includes(distance) ? "friend" : "enemy";
}

function houseOf(houses: Bhava[], g: GrahaName): number {
  const bhava = houses.find((h) => h.grahas.includes(g));
  if (!bhava) throw new Error(`${g} is not placed in any house`);
  return bhava.house;
}

/** Combine natural + temporal friendship into the five-tier Pañchadhā Maitri. */
function compoundRelation(reference: GrahaName, target: GrahaName, houses: Bhava[]): CompoundRelation {
  const natural = naturalRelation(reference, target);
  const temporal = temporalRelation(houses, reference, target);
  if (natural === "friend") return temporal === "friend" ? "GREAT_FRIEND" : "NEUTRAL";
  if (natural === "neutral") return temporal === "friend" ? "FRIEND" : "ENEMY";
  return temporal === "friend" ? "NEUTRAL" : "GREAT_ENEMY";
}

function isFavorable(r: CompoundRelation): boolean {
  return r === "SELF" || r === "GREAT_FRIEND" || r === "FRIEND";
}
function isCaution(r: CompoundRelation): boolean {
  return r === "ENEMY" || r === "GREAT_ENEMY";
}

export type SignPlacementView = {
  rashi: number;
  rashiName: LocalizedString;
  degreeInRashi: number;
  lord: GrahaName;
  lordName: LocalizedString;
};

export type MahadashaView = {
  lord: GrahaName;
  lordName: LocalizedString;
  start: Date;
  end: Date;
  antardashaLord: GrahaName | null;
  antardashaLordName: LocalizedString | null;
  antardashaStart: Date | null;
  antardashaEnd: Date | null;
};

export type PlanetMatchView = {
  planet: GrahaName;
  planetName: LocalizedString;
  gemstone: LocalizedString;
  relationToLagnaLord: CompoundRelation;
  relationToMahadashaLord: CompoundRelation;
};

export type BhavaView = {
  house: number;
  rashi: number;
  rashiName: LocalizedString;
  grahas: GrahaName[];
};

export type KundaliRecommendationView = {
  ascendant: SignPlacementView;
  moonSign: SignPlacementView;
  nakshatra: { name: LocalizedString; pada: number };
  currentMahadasha: MahadashaView;
  planetRelations: PlanetMatchView[];
  favorablePlanets: PlanetMatchView[];
  cautionPlanets: PlanetMatchView[];
  /** D1 (Rāśi) whole-sign houses from the lagna — for a North Indian style chart. */
  houses: BhavaView[];
  /** Same D1 placements, houses renumbered from the Moon instead of the lagna — the Chandra Kuṇḍalī. */
  chandraHouses: BhavaView[];
};

export type KundaliArgs = {
  date: string;
  time: string;
  latitude: number;
  longitude: number;
  timezone?: string | null;
  ayanamsa?: AyanamsaSystem | null;
};

export function getKundaliRecommendation(args: KundaliArgs): KundaliRecommendationView {
  if (!ISO_DATE.test(args.date)) throw badInput("date must be yyyy-mm-dd");
  if (!WALL_TIME.test(args.time)) throw badInput("time must be HH:MM or HH:MM:SS (24-hour)");
  if (!Number.isFinite(args.latitude) || args.latitude < -90 || args.latitude > 90) {
    throw badInput("latitude must be between -90 and 90");
  }
  if (!Number.isFinite(args.longitude) || args.longitude < -180 || args.longitude > 180) {
    throw badInput("longitude must be between -180 and 180");
  }

  const timezone = args.timezone ?? "Asia/Kolkata";
  const ayanamsa = args.ayanamsa ?? "lahiri";

  let k: Kundali;
  try {
    k = generateKundali({
      date: args.date,
      time: args.time,
      latitude: args.latitude,
      longitude: args.longitude,
      timezone,
      ayanamsa,
    });
  } catch (err) {
    throw badInput(err instanceof Error ? err.message : "Could not compute the birth chart");
  }

  const dasha = vimshottariDasha(k);
  const chain = activeDashaChain(dasha.mahadashas);
  const maha = chain[0];
  if (!maha) {
    throw badInput("No Mahādaśā is running at the current date for this birth chart");
  }
  const antar = chain[1] ?? null;

  /**
   * Workaround for a confirmed bug in vedic-kundali@0.1.0: `ascendantTropicalLongitude`
   * (and hence `computeAscendant`, which is built on it) returns the
   * Descendant, not the Ascendant — off by exactly 180°. Confirmed against
   * Swiss Ephemeris (`pyswisseph`, sidereal/Lahiri) across five varied birth
   * cases spanning both hemispheres and east/west longitudes: adding 180°
   * back reproduces Swiss Ephemeris exactly every time. Every other
   * placement (grahas, Moon sign, nakshatra, dasha) matches Swiss Ephemeris
   * directly, so this is the only thing that needs correcting.
   *
   * Rather than patch the buggy `k.ascendant.rashi` after the fact, we redo
   * the actual tropical→sidereal→rāśi conversion ourselves with the 180°
   * restored, then rebuild the lagna-based houses via the library's own
   * `wholeSignHouses` — exactly the same call `generateKundali` makes
   * internally, just with the corrected lagna rāśi. `dateToJD(k.birthInstant)`
   * reproduces the library's internal `jdUT` exactly (that's how it derived
   * `birthInstant` in the first place), and `k.ayanamsaValue` is already
   * `ayanamsa(jdUT, system)`, so no astronomy is re-derived here beyond the
   * one broken step.
   *
   * Do NOT "re-verify" this by re-deriving the ascendant from the textbook
   * RAMC-based formula (Meeus 13.6) from scratch — that formula's `atan2` has
   * a quadrant ambiguity (it can return either the Ascendant or the
   * Descendant, 180° apart, depending on argument-sign convention), and a
   * naive re-derivation reproduces the *same* bug rather than catching it.
   * Cross-check against an independent implementation (Swiss Ephemeris)
   * instead.
   */
  const jdUT = dateToJD(k.birthInstant);
  const trueTropicalLongitude = (ascendantTropicalLongitude(jdUT, args.latitude, args.longitude) + 180) % 360;
  const ascendantSidereal = ((trueTropicalLongitude - k.ayanamsaValue) % 360 + 360) % 360;
  const ascendantPlacement = rashiPlacement(ascendantSidereal);
  const ascendant: SignPlacementView = {
    rashi: ascendantPlacement.rashi,
    rashiName: localized(ascendantPlacement.rashiName),
    degreeInRashi: ascendantPlacement.degreeInRashi,
    lord: rashiLord(ascendantPlacement.rashi),
    lordName: localized(GRAHA_NAMES[rashiLord(ascendantPlacement.rashi)]),
  };
  const correctedHouses: Bhava[] = wholeSignHouses(ascendant.rashi, (g) => k.grahas[g].rashi);

  const lagnaLord = rashiLord(ascendant.rashi);
  const mahadashaLord = maha.lord;

  const planetRelations: PlanetMatchView[] = GRAHA_ORDER.map((g) => ({
    planet: g,
    planetName: localized(GRAHA_NAMES[g]),
    gemstone: GEMSTONE_BY_GRAHA[g],
    relationToLagnaLord: g === lagnaLord ? "SELF" : compoundRelation(lagnaLord, g, correctedHouses),
    relationToMahadashaLord:
      g === mahadashaLord ? "SELF" : compoundRelation(mahadashaLord, g, correctedHouses),
  }));

  const favorablePlanets = planetRelations.filter(
    (p) =>
      (isFavorable(p.relationToLagnaLord) && !isCaution(p.relationToMahadashaLord)) ||
      (isFavorable(p.relationToMahadashaLord) && !isCaution(p.relationToLagnaLord)),
  );
  const cautionPlanets = planetRelations.filter(
    (p) =>
      !favorablePlanets.includes(p) &&
      (isCaution(p.relationToLagnaLord) || isCaution(p.relationToMahadashaLord)),
  );

  return {
    ascendant,
    moonSign: {
      rashi: k.moonSign,
      rashiName: localized(k.moonSignName),
      degreeInRashi: k.grahas.Moon.degreeInRashi,
      lord: rashiLord(k.moonSign),
      lordName: localized(GRAHA_NAMES[rashiLord(k.moonSign)]),
    },
    nakshatra: { name: localized(k.nakshatra.name), pada: k.nakshatra.pada },
    currentMahadasha: {
      lord: maha.lord,
      lordName: localized(maha.lordName),
      start: maha.start,
      end: maha.end,
      antardashaLord: antar?.lord ?? null,
      antardashaLordName: antar ? localized(antar.lordName) : null,
      antardashaStart: antar?.start ?? null,
      antardashaEnd: antar?.end ?? null,
    },
    planetRelations,
    favorablePlanets,
    cautionPlanets,
    houses: correctedHouses.map(toBhavaView),
    chandraHouses: k.chandraKundaliHouses.map(toBhavaView),
  };
}

function toBhavaView(b: Bhava): BhavaView {
  return { house: b.house, rashi: b.rashi, rashiName: localized(b.rashiName), grahas: b.grahas };
}
