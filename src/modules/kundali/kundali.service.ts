import {
  generateKundali,
  vimshottariDasha,
  activeDashaChain,
  ascendantTropicalLongitude,
  rashiPlacement,
  nakshatraPlacement,
  wholeSignHouses,
  buildDivisionalChart,
  GRAHA_ORDER,
  GRAHA_NAMES,
  type Kundali,
  type GrahaName,
  type Bhava,
  type Ascendant,
  type VargaCode,
} from "vedic-kundali";
import { dateToJD, type AyanamsaSystem, type Name } from "vedic-panchanga";
import { badInput } from "../../shared/errors.js";
import type { LocalizedString } from "../../shared/localized.js";
import {
  rashiLord,
  naturalRelation,
  GEMSTONE_BY_GRAHA,
  rashisRuledBy,
  functionalNature,
  rahuKetuFunctionalNature,
  dignityOf,
  isCombust,
  strengthOf,
  isYogakaraka,
  type ClassicalGraha,
  type FunctionalNature,
  type Dignity,
  type Strength,
} from "./graha-reference.js";

/**
 * Thin wrapper over `vedic-kundali`: generates the birth chart + current
 * Vimśottarī Mahādaśā, then works out which grahas are astrologically
 * favorable vs. ones to approach with caution — for gemstone recommendation,
 * via each graha's **functional nature** relative to the Ascendant (Lagna):
 * fixed per ascendant sign (see `functionalNature` in `graha-reference.ts`),
 * driven by house lordship (trikona lords are friends, dusthana lords are
 * enemies, the Lagna lord itself is always a friend even with a secondary
 * dusthana) with the symmetric natural relationship to the Lagna lord as a
 * tie-break for grahas that own neither. `favorablePlanets`/`cautionPlanets`/
 * `neutralPlanets` are an exact partition of all nine grahas by this
 * `lagnaFunctionalNature` field, exposed per graha in `planetRelations`.
 *
 * This is a *different* system from the classical Pañchadhā (compound)
 * Maitri also exposed per graha (`relationToLagnaLord`/
 * `relationToMahadashaLord`) — Pañchadhā is chart-placement-dependent
 * (varies with each graha's exact house in this one chart), whereas
 * functional nature is fixed for every chart sharing the same ascendant
 * sign, which is what gemstone-recommendation practice actually uses.
 * Pañchadhā fields are kept only as supplementary reference data now; they no
 * longer drive favorablePlanets/cautionPlanets/neutralPlanets.
 *
 * `friendlyRashis`/`enemyRashis` are derived from favorable/caution grahas'
 * own classical sign-lordship (`RASHI_LORDS`), for widening product matching
 * to rashi-tagged items, not just graha-tagged ones — Rāhu/Ketu rule no
 * rashi, so they contribute nothing to either list.
 *
 * Separately, `recommendConsultation` flags when the currently running
 * Mahādaśā lord's functional nature is itself ENEMY: in that case a
 * gemstone match isn't the right remedy, and callers should steer the
 * shopper to an astrologer consultation instead of the crystal matching
 * below.
 *
 * `gemstoneRecommendation` is the single best-reasoned candidate for "which
 * one gemstone", via `pickGemstoneRecommendation`'s priority chain (Lagna
 * lord → Yogakaraka → Mahādaśā lord → Antardaśā lord → any other favorable
 * graha) — deliberately NOT "Mahādaśā/Antardaśā lord ⇒ its gemstone": a
 * graha only qualifies if it's functionally FRIEND *and* not already STRONG
 * (own sign/exalted, net of combustion). Dignity/strength/combustion/
 * retrograde/Yogakaraka/Vargottama are computed per graha and exposed on
 * every `PlanetMatchView` for this.
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

/** For varga labels specifically: prefer the library's plain-English gloss ("Career") over the IAST transliteration ("Dasamsa") when it has one. */
const localizedVargaLabel = (n: Name): LocalizedString => ({ en: n.english ?? n.iast, hi: n.devanagari });

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

/**
 * The priority chain a gemstone recommendation actually follows: never
 * "Mahādaśā/Antardaśā lord ⇒ wear its gemstone" on its own — a graha only
 * qualifies if it's functionally FRIEND for the Lagna *and* not already
 * STRONG (an already-strong or functionally hostile graha isn't strengthened
 * further just because it's running Dasha). Checked in order: Lagna lord,
 * Yogakaraka, the running Mahādaśā lord, the running Antardaśā lord, then
 * any other qualifying favorable graha. `null` if nothing qualifies.
 */
function pickGemstoneRecommendation(
  planets: PlanetMatchView[],
  lagnaLord: GrahaName,
  mahadashaLord: GrahaName,
  antardashaLord: GrahaName | null,
): GemstoneRecommendationView | null {
  const byPlanet = new Map(planets.map((p) => [p.planet, p]));
  const qualifies = (p: PlanetMatchView | undefined): p is PlanetMatchView =>
    !!p && p.lagnaFunctionalNature === "FRIEND" && p.strength !== "STRONG";

  const lagnaLordP = byPlanet.get(lagnaLord);
  if (qualifies(lagnaLordP)) return { ...lagnaLordP, tier: "LAGNA_LORD" };

  const yogakarakaP = planets.find((p) => p.isYogakaraka && qualifies(p));
  if (yogakarakaP) return { ...yogakarakaP, tier: "YOGAKARAKA" };

  const mahaP = byPlanet.get(mahadashaLord);
  if (qualifies(mahaP)) return { ...mahaP, tier: "MAHADASHA_LORD" };

  const antarP = antardashaLord ? byPlanet.get(antardashaLord) : undefined;
  if (qualifies(antarP)) return { ...antarP, tier: "ANTARDASHA_LORD" };

  const otherP = planets.find((p) => qualifies(p));
  if (otherP) return { ...otherP, tier: "OTHER_FRIEND" };

  return null;
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
  /** Functional benefic/malefic/neutral nature for this Lagna — drives favorablePlanets/cautionPlanets/neutralPlanets. */
  lagnaFunctionalNature: FunctionalNature;
  relationToLagnaLord: CompoundRelation;
  relationToMahadashaLord: CompoundRelation;
  /** Sign-based dignity in the D1 chart — exaltation/own-sign/friend-neutral-enemy sign/debilitation. */
  dignity: Dignity;
  /** dignity + combustion collapsed into a three-tier read — what the gemstone selector reasons over. */
  strength: Strength;
  /** Within combustion orb of the Sun. Always false for Sun/Rāhu/Ketu. */
  isCombust: boolean;
  /** Apparent retrograde motion at birth. Always true for Rāhu/Ketu, always false for Sun/Moon. */
  isRetrograde: boolean;
  /** Rules both a kendra (4th/7th/10th) and a trikona (5th/9th) house from the Lagna — a Yogakaraka. */
  isYogakaraka: boolean;
  /** Same rāśi in D1 and D9 (Navāṃśa) — doubles the graha's strength classically. */
  isVargottama: boolean;
};

/** Which step of the priority chain (Lagna lord → Yogakaraka → Mahādaśā lord → Antardaśā lord → other) selected the recommended graha. */
export type GemstoneRecommendationTier =
  | "LAGNA_LORD"
  | "YOGAKARAKA"
  | "MAHADASHA_LORD"
  | "ANTARDASHA_LORD"
  | "OTHER_FRIEND";

export type GemstoneRecommendationView = PlanetMatchView & { tier: GemstoneRecommendationTier };

export type BhavaView = {
  house: number;
  rashi: number;
  rashiName: LocalizedString;
  grahas: GrahaName[];
};

export type RashiView = {
  rashi: number;
  rashiName: LocalizedString;
};

/**
 * Every bracelet is strung with this many beads: a single-gem bracelet is all 21 of one gem, a
 * combination splits them across the trikona lords below. The frontend keeps its own copy of this
 * number for single bracelets (`BRACELET_BEADS` in `frontend/lib/bracelet/design.ts`).
 */
export const BRACELET_TOTAL_BEADS = 21;

/**
 * The combination bracelet: which houses' lords contribute, and how many of the 21 beads each gets
 * — Lagna lord the most, then the 9th, then the 5th. Always three *different* grahas: the 1st, 5th
 * and 9th signs share an element, and each element's three signs have three different lords.
 */
const BRACELET_COMBO_PLAN = [
  { house: 1, beads: 9 },
  { house: 9, beads: 7 },
  { house: 5, beads: 5 },
] as const;

/** One block of beads in the combination bracelet — the gem of one house's lord and how many beads it gets. */
export type BraceletSegmentView = {
  house: number;
  planet: GrahaName;
  planetName: LocalizedString;
  gemstone: LocalizedString;
  beads: number;
};

export type DivisionalChartView = {
  code: string;
  label: LocalizedString;
  houses: BhavaView[];
};

export type KundaliRecommendationView = {
  ascendant: SignPlacementView;
  moonSign: SignPlacementView;
  nakshatra: { name: LocalizedString; pada: number };
  currentMahadasha: MahadashaView;
  planetRelations: PlanetMatchView[];
  favorablePlanets: PlanetMatchView[];
  cautionPlanets: PlanetMatchView[];
  /** Grahas neither friendly nor hostile to the Lagna lord (compound relation NEUTRAL). */
  neutralPlanets: PlanetMatchView[];
  /** Rāśis ruled by a favorablePlanets graha — for widening product matching beyond graha tags. */
  friendlyRashis: RashiView[];
  /** Rāśis ruled by a cautionPlanets graha. */
  enemyRashis: RashiView[];
  /** True when the running Mahādaśā lord is hostile (ENEMY/GREAT_ENEMY) to the Lagna lord. */
  recommendConsultation: boolean;
  /**
   * The single best-reasoned gemstone candidate, by the priority chain: Lagna
   * lord → Yogakaraka → Mahādaśā lord → Antardaśā lord → any other favorable
   * graha — each only qualifying if it's functionally FRIEND *and* not
   * already STRONG (an already-strong or functionally hostile graha is never
   * strengthened further just because it's running Dasha). `null` when no
   * graha qualifies — the chart doesn't call for strengthening any one graha
   * right now, and that should be said plainly rather than forcing a pick.
   */
  gemstoneRecommendation: GemstoneRecommendationView | null;
  /**
   * The combination bracelet's bead blocks, in wearing order (1st → 9th → 5th house lord),
   * summing to `BRACELET_TOTAL_BEADS`. Fixed by the Lagna alone — independent of Mahādaśā and of
   * `recommendConsultation`, which callers may still choose to gate the offer on.
   */
  braceletCombo: BraceletSegmentView[];
  /** D1 (Rāśi) whole-sign houses from the lagna — for a North Indian style chart. */
  houses: BhavaView[];
  /** Same D1 placements, houses renumbered from the Moon instead of the lagna — the Chandra Kuṇḍalī. */
  chandraHouses: BhavaView[];
  /**
   * A curated set of divisional (varga) charts beyond D1 — Navāṃśa (D9),
   * Daśāṃśa (D10, career), Saptāṃśa (D7, children), Dvādaśāṃśa (D12,
   * parents) — each in the same whole-sign `houses` shape as `houses`
   * above, so the same chart-rendering component can show any of them.
   */
  divisionalCharts: DivisionalChartView[];
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

  /**
   * The 180° ascendant bug above propagates into every `k.vargas[code]`
   * too — `buildDivisionalChart` is what computes them internally, driven
   * by the library's own (buggy) ascendant. Confirmed empirically across
   * D1/D7/D9/D10/D12 for a real chart: every one comes out shifted by
   * exactly the same 6 rashis as `k.ascendant` itself. Rather than lean on
   * that pattern holding, we just rebuild each curated varga directly from
   * the already-corrected ascendant, exactly like `correctedHouses` above
   * does for D1 — `k.grahas` itself is unaffected by the bug, so it's
   * reused as-is.
   */
  const correctedAscendant: Ascendant = {
    ...ascendantPlacement,
    longitude: ascendantSidereal,
    nakshatra: nakshatraPlacement(ascendantSidereal),
  };
  const CURATED_VARGAS: VargaCode[] = ["D9", "D10", "D7", "D12"];
  const divisionalCharts: DivisionalChartView[] = CURATED_VARGAS.map((code) => {
    const varga = buildDivisionalChart(code, correctedAscendant, k.grahas);
    return {
      code: varga.code,
      label: localizedVargaLabel(varga.label),
      houses: (varga.houses ?? []).map(toBhavaView),
    };
  });

  const lagnaLord = rashiLord(ascendant.rashi);
  const mahadashaLord = maha.lord;

  const lagnaFunctionalNatureOf = (g: GrahaName): FunctionalNature => {
    if (g === "Rahu") return rahuKetuFunctionalNature(k.grahas.Rahu.rashi, ascendant.rashi);
    if (g === "Ketu") return rahuKetuFunctionalNature(k.grahas.Ketu.rashi, ascendant.rashi);
    return functionalNature(g as ClassicalGraha, ascendant.rashi);
  };

  const d9 = k.vargas.D9;

  const planetRelations: PlanetMatchView[] = GRAHA_ORDER.map((g) => {
    const dignity = dignityOf(g, k.grahas[g].rashi);
    const combust = isCombust(k.grahas[g].longitude, k.grahas.Sun.longitude, g);
    return {
      planet: g,
      planetName: localized(GRAHA_NAMES[g]),
      gemstone: GEMSTONE_BY_GRAHA[g],
      lagnaFunctionalNature: lagnaFunctionalNatureOf(g),
      relationToLagnaLord: g === lagnaLord ? "SELF" : compoundRelation(lagnaLord, g, correctedHouses),
      relationToMahadashaLord:
        g === mahadashaLord ? "SELF" : compoundRelation(mahadashaLord, g, correctedHouses),
      dignity,
      strength: strengthOf(dignity, combust),
      isCombust: combust,
      isRetrograde: k.grahas[g].isRetrograde,
      isYogakaraka: g !== "Rahu" && g !== "Ketu" && isYogakaraka(g as ClassicalGraha, ascendant.rashi),
      isVargottama: d9.positions[g] === k.grahas[g].rashi,
    };
  });

  const favorablePlanets = planetRelations.filter((p) => p.lagnaFunctionalNature === "FRIEND");
  const cautionPlanets = planetRelations.filter((p) => p.lagnaFunctionalNature === "ENEMY");
  const neutralPlanets = planetRelations.filter((p) => p.lagnaFunctionalNature === "NEUTRAL");

  const mahadashaLordFunctionalNature = planetRelations.find(
    (p) => p.planet === mahadashaLord,
  )!.lagnaFunctionalNature;
  const recommendConsultation = mahadashaLordFunctionalNature === "ENEMY";

  const rashiNameByNumber = new Map(correctedHouses.map((b) => [b.rashi, localized(b.rashiName)]));
  const rashisFor = (planets: PlanetMatchView[]): RashiView[] => {
    const nums = new Set<number>();
    for (const p of planets) for (const rashi of rashisRuledBy(p.planet)) nums.add(rashi);
    return [...nums].sort((a, b) => a - b).map((rashi) => ({
      rashi,
      rashiName: rashiNameByNumber.get(rashi)!,
    }));
  };
  const friendlyRashis = rashisFor(favorablePlanets);
  const enemyRashis = rashisFor(cautionPlanets);

  const gemstoneRecommendation = pickGemstoneRecommendation(
    planetRelations,
    lagnaLord,
    mahadashaLord,
    antar?.lord ?? null,
  );

  const braceletCombo: BraceletSegmentView[] = BRACELET_COMBO_PLAN.map(({ house, beads }) => {
    const planet = rashiLord(correctedHouses.find((b) => b.house === house)!.rashi);
    return { house, planet, planetName: localized(GRAHA_NAMES[planet]), gemstone: GEMSTONE_BY_GRAHA[planet], beads };
  });

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
    neutralPlanets,
    friendlyRashis,
    enemyRashis,
    recommendConsultation,
    gemstoneRecommendation,
    braceletCombo,
    houses: correctedHouses.map(toBhavaView),
    chandraHouses: k.chandraKundaliHouses.map(toBhavaView),
    divisionalCharts,
  };
}

function toBhavaView(b: Bhava): BhavaView {
  return { house: b.house, rashi: b.rashi, rashiName: localized(b.rashiName), grahas: b.grahas };
}
