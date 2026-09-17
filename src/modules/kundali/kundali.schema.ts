import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import {
  getKundaliRecommendation,
  type SignPlacementView,
  type MahadashaView,
  type PlanetMatchView,
  type BhavaView,
  type KundaliRecommendationView,
} from "./kundali.service.js";

const AyanamsaEnum = builder.enumType("KundaliAyanamsa", {
  values: ["lahiri", "raman", "kp", "fagan_bradley"] as const,
});

const CompoundRelationEnum = builder.enumType("PlanetRelation", {
  values: ["GREAT_FRIEND", "FRIEND", "NEUTRAL", "ENEMY", "GREAT_ENEMY", "SELF"] as const,
  description:
    "Pañchadhā (compound) Maitri — natural (fixed) friendship combined with temporal " +
    "(this chart's house placements) friendship. SELF marks the reference planet itself.",
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
        description: "All nine grahas, each related to both the Lagna lord and the Mahādaśā lord.",
      }),
      favorablePlanets: t.field({
        type: [PlanetMatchRef],
        resolve: (k) => k.favorablePlanets,
        description: "Grahas friendly to the Lagna lord and/or the Mahādaśā lord — recommended gemstones.",
      }),
      cautionPlanets: t.field({
        type: [PlanetMatchRef],
        resolve: (k) => k.cautionPlanets,
        description: "Grahas hostile to the Lagna lord and/or the Mahādaśā lord — gemstones to avoid.",
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
        "Compute a birth chart and its current Mahādaśā, and work out which grahas (and their " +
        "gemstones) are astrologically favorable vs. ones to approach with caution.",
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
