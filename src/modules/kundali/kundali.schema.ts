import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import {
  getKundaliRecommendation,
  type SignPlacementView,
  type MahadashaView,
  type PlanetMatchView,
  type BhavaView,
  type RashiView,
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

const KundaliRashiRef = builder.objectRef<RashiView>("KundaliRashi").implement({
  fields: (t) => ({
    rashi: t.exposeInt("rashi", { description: "1 (Mesha) – 12 (Meena)." }),
    rashiName: t.field({ type: LocalizedStringRef, resolve: (r) => r.rashiName }),
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
