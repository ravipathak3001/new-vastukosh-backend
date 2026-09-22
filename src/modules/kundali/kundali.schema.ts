import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import {
  getKundaliRecommendation,
  type SignPlacementView,
  type MahadashaView,
  type PlanetMatchView,
  type GemstoneRecommendationView,
  type BhavaView,
  type BraceletSegmentView,
  type RashiView,
  type DivisionalChartView,
  type KundaliRecommendationView,
} from "./kundali.service.js";

const AyanamsaEnum = builder.enumType("KundaliAyanamsa", {
  values: ["lahiri", "raman", "kp", "fagan_bradley"] as const,
});

const CompoundRelationEnum = builder.enumType("PlanetRelation", {
  values: ["GREAT_FRIEND", "FRIEND", "NEUTRAL", "ENEMY", "GREAT_ENEMY", "SELF"] as const,
  description:
    "Pañchadhā (compound) Maitri — natural (fixed) friendship combined with temporal " +
    "(this chart's house placements) friendship. SELF marks the reference planet itself. " +
    "Supplementary reference data — favorablePlanets/cautionPlanets/neutralPlanets are driven " +
    "by lagnaFunctionalNature instead, not by this field.",
});

const FunctionalNatureEnum = builder.enumType("PlanetFunctionalNature", {
  values: ["FRIEND", "NEUTRAL", "ENEMY"] as const,
  description:
    "Functional benefic/malefic/neutral nature for this Lagna, fixed per ascendant sign (house " +
    "lordship: trikona lords are friends, dusthana lords are enemies, the Lagna lord is always a " +
    "friend, with natural relationship to the Lagna lord as a tie-break otherwise) — the system " +
    "gemstone recommendations use. Drives favorablePlanets/cautionPlanets/neutralPlanets.",
});

const DignityEnum = builder.enumType("PlanetDignity", {
  values: ["EXALTED", "OWN_SIGN", "FRIEND_SIGN", "NEUTRAL_SIGN", "ENEMY_SIGN", "DEBILITATED"] as const,
  description:
    "Sign-based dignity in the D1 chart: exaltation/debilitation sign (whole-sign, not degree-" +
    "gated), own sign, or friend/neutral/enemy sign by natural relationship with the sign's lord.",
});

const StrengthEnum = builder.enumType("PlanetStrength", {
  values: ["STRONG", "MODERATE", "WEAK"] as const,
  description: "Dignity collapsed to three tiers, one notch weaker if combust — what gemstoneRecommendation reasons over.",
});

const GemstoneRecommendationTierEnum = builder.enumType("GemstoneRecommendationTier", {
  values: ["LAGNA_LORD", "YOGAKARAKA", "MAHADASHA_LORD", "ANTARDASHA_LORD", "OTHER_FRIEND"] as const,
  description: "Which step of the priority chain selected gemstoneRecommendation's graha.",
});

const SignPlacementRef = builder.objectRef<SignPlacementView>("KundaliSignPlacement").implement({
  fields: (t) => ({
    rashi: t.exposeInt("rashi", { description: "1 (Mesha) – 12 (Meena)." }),
    rashiName: t.field({ type: LocalizedStringRef, resolve: (p) => p.rashiName }),
    degreeInRashi: t.exposeFloat("degreeInRashi", { description: "0–30 degrees elapsed within the rashi." }),
    lord: t.exposeString("lord", { description: "The graha ruling this rashi." }),
    lordName: t.field({ type: LocalizedStringRef, resolve: (p) => p.lordName }),
  }),
});

const NakshatraRef = builder
  .objectRef<KundaliRecommendationView["nakshatra"]>("KundaliNakshatra")
  .implement({
    fields: (t) => ({
      name: t.field({ type: LocalizedStringRef, resolve: (n) => n.name }),
      pada: t.exposeInt("pada", { description: "1–4." }),
    }),
  });

const MahadashaRef = builder.objectRef<MahadashaView>("KundaliMahadasha").implement({
  description: "The Vimśottarī Mahādaśā (and nested Antardaśā) running as of now.",
  fields: (t) => ({
    lord: t.exposeString("lord"),
    lordName: t.field({ type: LocalizedStringRef, resolve: (m) => m.lordName }),
    start: t.field({ type: "DateTime", resolve: (m) => m.start }),
    end: t.field({ type: "DateTime", resolve: (m) => m.end }),
    antardashaLord: t.exposeString("antardashaLord", { nullable: true }),
    antardashaLordName: t.field({
      type: LocalizedStringRef,
      nullable: true,
      resolve: (m) => m.antardashaLordName,
    }),
    antardashaStart: t.field({ type: "DateTime", nullable: true, resolve: (m) => m.antardashaStart }),
    antardashaEnd: t.field({ type: "DateTime", nullable: true, resolve: (m) => m.antardashaEnd }),
  }),
});

const PlanetMatchRef = builder.objectRef<PlanetMatchView>("KundaliPlanetMatch").implement({
  fields: (t) => ({
    planet: t.exposeString("planet"),
    planetName: t.field({ type: LocalizedStringRef, resolve: (p) => p.planetName }),
    gemstone: t.field({ type: LocalizedStringRef, resolve: (p) => p.gemstone }),
    lagnaFunctionalNature: t.field({
      type: FunctionalNatureEnum,
      resolve: (p) => p.lagnaFunctionalNature,
    }),
    relationToLagnaLord: t.field({ type: CompoundRelationEnum, resolve: (p) => p.relationToLagnaLord }),
    relationToMahadashaLord: t.field({
      type: CompoundRelationEnum,
      resolve: (p) => p.relationToMahadashaLord,
    }),
    dignity: t.field({ type: DignityEnum, resolve: (p) => p.dignity }),
    strength: t.field({ type: StrengthEnum, resolve: (p) => p.strength }),
    isCombust: t.exposeBoolean("isCombust"),
    isRetrograde: t.exposeBoolean("isRetrograde"),
    isYogakaraka: t.exposeBoolean("isYogakaraka"),
    isVargottama: t.exposeBoolean("isVargottama", {
      description: "Same rāśi in D1 and D9 (Navāṃśa) — classically doubles the graha's strength.",
    }),
  }),
});

const GemstoneRecommendationRef = builder
  .objectRef<GemstoneRecommendationView>("KundaliGemstoneRecommendation")
  .implement({
    description:
      "The single best-reasoned gemstone candidate, from a priority chain (Lagna lord → " +
      "Yogakaraka → Mahādaśā lord → Antardaśā lord → any other favorable graha) where a graha " +
      "only qualifies if it's functionally FRIEND and not already STRONG — never a bare " +
      "\"Mahādaśā/Antardaśā lord ⇒ its gemstone\".",
    fields: (t) => ({
      planet: t.exposeString("planet"),
      planetName: t.field({ type: LocalizedStringRef, resolve: (p) => p.planetName }),
      gemstone: t.field({ type: LocalizedStringRef, resolve: (p) => p.gemstone }),
      lagnaFunctionalNature: t.field({
        type: FunctionalNatureEnum,
        resolve: (p) => p.lagnaFunctionalNature,
      }),
      relationToLagnaLord: t.field({ type: CompoundRelationEnum, resolve: (p) => p.relationToLagnaLord }),
      relationToMahadashaLord: t.field({
        type: CompoundRelationEnum,
        resolve: (p) => p.relationToMahadashaLord,
      }),
      dignity: t.field({ type: DignityEnum, resolve: (p) => p.dignity }),
      strength: t.field({ type: StrengthEnum, resolve: (p) => p.strength }),
      isCombust: t.exposeBoolean("isCombust"),
      isRetrograde: t.exposeBoolean("isRetrograde"),
      isYogakaraka: t.exposeBoolean("isYogakaraka"),
      isVargottama: t.exposeBoolean("isVargottama"),
      tier: t.field({ type: GemstoneRecommendationTierEnum, resolve: (p) => p.tier }),
    }),
  });

const KundaliBhavaRef = builder.objectRef<BhavaView>("KundaliBhava").implement({
  description: "One house (bhāva) of the D1 whole-sign chart, from the lagna.",
  fields: (t) => ({
    house: t.exposeInt("house", { description: "1 (lagna) – 12." }),
    rashi: t.exposeInt("rashi", { description: "1 (Mesha) – 12 (Meena) — the sign occupying this house." }),
    rashiName: t.field({ type: LocalizedStringRef, resolve: (b) => b.rashiName }),
    grahas: t.exposeStringList("grahas", { description: "Grahas placed in this house." }),
  }),
});

const KundaliBraceletSegmentRef = builder.objectRef<BraceletSegmentView>("KundaliBraceletSegment").implement({
  description: "One block of beads in the combination bracelet: one house lord's gemstone and how many beads it gets.",
  fields: (t) => ({
    house: t.exposeInt("house", { description: "Which house's lord this block is for — 1, 9 or 5." }),
    planet: t.exposeString("planet", { description: "The graha ruling that house for this Lagna." }),
    planetName: t.field({ type: LocalizedStringRef, resolve: (b) => b.planetName }),
    gemstone: t.field({ type: LocalizedStringRef, resolve: (b) => b.gemstone }),
    beads: t.exposeInt("beads", { description: "Beads of this gemstone in the bracelet." }),
  }),
});

const KundaliRashiRef = builder.objectRef<RashiView>("KundaliRashi").implement({
  fields: (t) => ({
    rashi: t.exposeInt("rashi", { description: "1 (Mesha) – 12 (Meena)." }),
    rashiName: t.field({ type: LocalizedStringRef, resolve: (r) => r.rashiName }),
  }),
});

const KundaliDivisionalChartRef = builder.objectRef<DivisionalChartView>("KundaliDivisionalChart").implement({
  description: "One divisional (varga) chart beyond D1, in the same whole-sign houses shape as `houses`.",
  fields: (t) => ({
    code: t.exposeString("code", { description: 'Varga code, e.g. "D9".' }),
    label: t.field({ type: LocalizedStringRef, resolve: (v) => v.label }),
    houses: t.field({ type: [KundaliBhavaRef], resolve: (v) => v.houses }),
  }),
});

const KundaliRecommendationRef = builder
  .objectRef<KundaliRecommendationView>("KundaliRecommendation")
  .implement({
    description:
      "A birth chart's ascendant, Moon sign, current Mahādaśā, and gemstone-relevant " +
      "planetary relationships, computed by vedic-kundali. Not certified astrological " +
      "advice — see the package's own accuracy notes.",
    fields: (t) => ({
      ascendant: t.field({ type: SignPlacementRef, resolve: (k) => k.ascendant }),
      moonSign: t.field({ type: SignPlacementRef, resolve: (k) => k.moonSign }),
      nakshatra: t.field({ type: NakshatraRef, resolve: (k) => k.nakshatra }),
      currentMahadasha: t.field({ type: MahadashaRef, resolve: (k) => k.currentMahadasha }),
      planetRelations: t.field({
        type: [PlanetMatchRef],
        resolve: (k) => k.planetRelations,
        description:
          "All nine grahas, with their functional nature for this Lagna plus, for reference, " +
          "their Pañchadhā relation to both the Lagna lord and the Mahādaśā lord.",
      }),
      favorablePlanets: t.field({
        type: [PlanetMatchRef],
        resolve: (k) => k.favorablePlanets,
        description: "Grahas functionally benefic for this Lagna — recommended gemstones.",
      }),
      cautionPlanets: t.field({
        type: [PlanetMatchRef],
        resolve: (k) => k.cautionPlanets,
        description: "Grahas functionally malefic for this Lagna — gemstones to avoid.",
      }),
      neutralPlanets: t.field({
        type: [PlanetMatchRef],
        resolve: (k) => k.neutralPlanets,
        description: "Grahas functionally neutral for this Lagna.",
      }),
      friendlyRashis: t.field({
        type: [KundaliRashiRef],
        resolve: (k) => k.friendlyRashis,
        description:
          "Rāśis ruled by a favorablePlanets graha, for matching products tagged by rashi as well " +
          "as by graha. Empty entries are possible if every favorable graha is Rāhu/Ketu, which rule none.",
      }),
      enemyRashis: t.field({
        type: [KundaliRashiRef],
        resolve: (k) => k.enemyRashis,
        description: "Rāśis ruled by a cautionPlanets graha.",
      }),
      recommendConsultation: t.exposeBoolean("recommendConsultation", {
        description:
          "True when the running Mahādaśā lord's own functional nature for this Lagna is ENEMY " +
          "— a gemstone match isn't the right remedy here, so callers should steer the shopper " +
          "to an astrologer consultation instead of the crystal matching from favorablePlanets.",
      }),
      gemstoneRecommendation: t.field({
        type: GemstoneRecommendationRef,
        nullable: true,
        resolve: (k) => k.gemstoneRecommendation,
        description:
          "The single best-reasoned gemstone candidate (see KundaliGemstoneRecommendation), or " +
          "null when no graha currently qualifies — say so plainly rather than forcing a pick.",
      }),
      braceletCombo: t.field({
        type: [KundaliBraceletSegmentRef],
        resolve: (k) => k.braceletCombo,
        description:
          "The combination bracelet as bead blocks in wearing order — 1st, 9th then 5th house lord's " +
          "gemstone, 9 / 7 / 5 of 21 beads. Determined by the Lagna alone (12 possible combinations).",
      }),
      houses: t.field({
        type: [KundaliBhavaRef],
        resolve: (k) => k.houses,
        description: "The D1 (Rāśi) chart's 12 whole-sign houses from the lagna, for rendering a chart — e.g. North Indian style.",
      }),
      chandraHouses: t.field({
        type: [KundaliBhavaRef],
        resolve: (k) => k.chandraHouses,
        description: "Same D1 placements, houses renumbered from the Moon instead of the lagna — the Chandra Kuṇḍalī.",
      }),
      divisionalCharts: t.field({
        type: [KundaliDivisionalChartRef],
        resolve: (k) => k.divisionalCharts,
        description:
          "A curated set of divisional (varga) charts beyond D1: Navāṃśa (D9), Daśāṃśa (D10, " +
          "career), Saptāṃśa (D7, children), Dvādaśāṃśa (D12, parents) — for a chart-viewer to " +
          "switch between alongside the main D1 `houses`.",
      }),
    }),
  });

export function registerKundaliModule() {
  builder.queryFields((t) => ({
    kundaliRecommendation: t.field({
      type: KundaliRecommendationRef,
      description:
        "Compute a birth chart and its current Mahādaśā, work out which grahas (and their " +
        "gemstones) are functionally benefic for the Lagna vs. functionally malefic, and flag " +
        "when the Mahādaśā lord itself is functionally malefic — in which case an astrologer " +
        "consultation is recommended over a gemstone match.",
      args: {
        date: t.arg.string({ required: true, description: "Birth date, yyyy-mm-dd." }),
        time: t.arg.string({
          required: true,
          description: "Birth wall-clock time, HH:MM or HH:MM:SS (24-hour), read in `timezone`.",
        }),
        latitude: t.arg.float({ required: true, description: "Birth-place latitude, north positive." }),
        longitude: t.arg.float({ required: true, description: "Birth-place longitude, east positive." }),
        timezone: t.arg.string({ required: false, description: "IANA timezone id. Default Asia/Kolkata." }),
        ayanamsa: t.arg({ type: AyanamsaEnum, required: false, description: "Sidereal zodiac. Default lahiri." }),
      },
      resolve: (_parent, args) =>
        getKundaliRecommendation({
          date: args.date,
          time: args.time,
          latitude: args.latitude,
          longitude: args.longitude,
          timezone: args.timezone,
          ayanamsa: args.ayanamsa,
        }),
    }),
  }));
}
