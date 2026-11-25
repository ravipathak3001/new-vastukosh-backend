import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import type { Observance } from "./observances.js";
import { nearestPlace, searchPlaces, type PlaceView } from "./places.js";
import {
  getObservances,
  getPanchang,
  getPanchangMonth,
  getPanchangTimeline,
  type PanchangDayView,
  type PanchangMonthView,
  type PanchangView,
  type PanchangAngaView,
  type PanchangKaalaView,
  type PanchangReferenceView,
  type PanchangSegmentView,
  type PanchangTimelineView,
} from "./panchang.service.js";

const MonthSystemEnum = builder.enumType("PanchangMonthSystem", {
  values: ["amanta", "purnimanta"] as const,
});

const PanchangLocationRef = builder
  .objectRef<PanchangView["location"]>("PanchangLocation")
  .implement({
    fields: (t) => ({
      latitude: t.exposeFloat("latitude"),
      longitude: t.exposeFloat("longitude"),
      place: t.exposeString("place", { nullable: true }),
    }),
  });

const ObservanceKindEnum = builder.enumType("PanchangObservanceKind", {
  values: ["festival", "vrat", "sankranti"] as const,
});

const PanchangObservanceRef = builder.objectRef<Observance>("PanchangObservance").implement({
  description:
    "A vrat, festival or sankranti on a day. Decided by the tithi at the observance's traditional time (sunrise, midday, pradosh, midnight or moonrise); regional calendars can differ by a day in edge years.",
  fields: (t) => ({
    key: t.exposeString("key", { description: "Stable id, e.g. `ekadashi`, `diwali`, `sankranti-makara`." }),
    kind: t.field({ type: ObservanceKindEnum, resolve: (o) => o.kind }),
    name: t.field({ type: LocalizedStringRef, resolve: (o) => o.name }),
    about: t.field({ type: LocalizedStringRef, resolve: (o) => o.about, description: "One or two lines on what is observed." }),
  }),
});

const PanchangAngaRef = builder.objectRef<PanchangAngaView>("PanchangAnga").implement({
  description:
    "One limb of the panchang (tithi, nakshatra, yoga, karana or vara) as it stands at sunrise, with the window it occupies.",
  fields: (t) => ({
    index: t.exposeInt("index", {
      description: "1-based position in its cycle (tithi 1–30, nakshatra/yoga 1–27, karana 1–11, vara 1–7).",
    }),
    name: t.field({ type: LocalizedStringRef, resolve: (a) => a.name }),
    start: t.field({ type: "DateTime", resolve: (a) => a.start }),
    end: t.field({ type: "DateTime", resolve: (a) => a.end }),
    fractionElapsed: t.exposeFloat("fractionElapsed", {
      description: "Fraction of this limb already elapsed at the query instant, 0–1.",
    }),
    pada: t.exposeInt("pada", { nullable: true, description: "Nakshatra quarter 1–4; null for other limbs." }),
    lord: t.exposeString("lord", { nullable: true, description: "Vimshottari lord of the nakshatra; null for other limbs." }),
  }),
});

const PanchangReferenceRef = builder
  .objectRef<PanchangReferenceView>("PanchangReference")
  .implement({
    description: "The instant the aṅgas, sidereal signs and `fractionElapsed` figures were evaluated at.",
    fields: (t) => ({
      kind: t.exposeString("kind", {
        description: '"sunrise" (the almanac default) or "time" when a `time` arg was supplied.',
      }),
      instant: t.field({ type: "DateTime", resolve: (r) => r.instant }),
    }),
  });

const PanchangKaalaRef = builder.objectRef<PanchangKaalaView>("PanchangKaala").implement({
  description: "A named window of the day — a muhurta or a kaala.",
  fields: (t) => ({
    name: t.field({ type: LocalizedStringRef, resolve: (k) => k.name }),
    start: t.field({ type: "DateTime", resolve: (k) => k.start }),
    end: t.field({ type: "DateTime", resolve: (k) => k.end }),
    quality: t.exposeString("quality", { description: '"auspicious" | "inauspicious".' }),
  }),
});

const PanchangRef = builder.objectRef<PanchangView>("Panchang").implement({
  description:
    "The Hindu almanac for one civil day at one place, computed by vedic-panchanga. Values are almanac-grade approximations — see the package's accuracy notes.",
  fields: (t) => ({
    date: t.exposeString("date", { description: "Resolved civil date, yyyy-mm-dd in `timezone`." }),
    timezone: t.exposeString("timezone"),
    location: t.field({ type: PanchangLocationRef, resolve: (p) => p.location }),
    ayanamsaSystem: t.exposeString("ayanamsaSystem"),
    ayanamsa: t.exposeFloat("ayanamsa", { description: "Ayanamsa used, in degrees." }),

    reference: t.field({
      type: PanchangReferenceRef,
      resolve: (p) => p.reference,
      description:
        "Which instant the aṅgas below reflect — the day's sunrise unless a `time` arg was given.",
    }),

    sunrise: t.field({ type: "DateTime", resolve: (p) => p.sunrise }),
    sunset: t.field({ type: "DateTime", resolve: (p) => p.sunset }),
    nextSunrise: t.field({ type: "DateTime", resolve: (p) => p.nextSunrise, description: "End of the vara." }),
    solarNoon: t.field({ type: "DateTime", nullable: true, resolve: (p) => p.solarNoon }),
    moonrise: t.field({ type: "DateTime", nullable: true, resolve: (p) => p.moonrise }),
    moonset: t.field({ type: "DateTime", nullable: true, resolve: (p) => p.moonset }),

    vara: t.field({ type: PanchangAngaRef, resolve: (p) => p.vara }),
    tithi: t.field({ type: PanchangAngaRef, resolve: (p) => p.tithi }),
    nakshatra: t.field({ type: PanchangAngaRef, resolve: (p) => p.nakshatra }),
    yoga: t.field({ type: PanchangAngaRef, resolve: (p) => p.yoga }),
    karana: t.field({ type: PanchangAngaRef, resolve: (p) => p.karana }),

    paksha: t.field({ type: LocalizedStringRef, resolve: (p) => p.paksha }),
    masa: t.field({ type: LocalizedStringRef, resolve: (p) => p.masa, description: "Lunar month per the requested monthSystem." }),
    masaAmanta: t.field({ type: LocalizedStringRef, resolve: (p) => p.masaAmanta }),
    masaPurnimanta: t.field({ type: LocalizedStringRef, resolve: (p) => p.masaPurnimanta }),
    ritu: t.field({ type: LocalizedStringRef, resolve: (p) => p.ritu, description: "Season." }),
    vikramSamvat: t.exposeInt("vikramSamvat"),
    shakaSamvat: t.exposeInt("shakaSamvat"),

    sunSign: t.field({ type: LocalizedStringRef, resolve: (p) => p.sunSign, description: "Sidereal rashi of the Sun." }),
    moonSign: t.field({ type: LocalizedStringRef, resolve: (p) => p.moonSign, description: "Sidereal rashi of the Moon (janma rashi of the day)." }),

    auspiciousPeriods: t.field({ type: [PanchangKaalaRef], resolve: (p) => p.auspiciousPeriods }),
    inauspiciousPeriods: t.field({ type: [PanchangKaalaRef], resolve: (p) => p.inauspiciousPeriods }),
    observances: t.field({
      type: [PanchangObservanceRef],
      description: "Vrats, festivals and sankranti falling on this civil day.",
      resolve: (p) =>
        getObservances(p.date, {
          latitude: p.location.latitude,
          longitude: p.location.longitude,
          timezone: p.timezone,
        }),
    }),
    currentPeriods: t.field({
      type: [PanchangKaalaRef],
      resolve: (p) => p.currentPeriods,
      description:
        "Auspicious/inauspicious windows containing `reference.instant`. Empty in sunrise mode; the \"what's running now\" answer when `time` is given.",
    }),
  }),
});

const PanchangSegmentRef = builder.objectRef<PanchangSegmentView>("PanchangSegment").implement({
  description: "One occupancy window of an anga within a day's timeline — the anga plus the span it holds.",
  fields: (t) => ({
    index: t.exposeInt("index", {
      description: "1-based position in its cycle (tithi 1–30, nakshatra/yoga 1–27, karana 1–11).",
    }),
    name: t.field({ type: LocalizedStringRef, resolve: (s) => s.name }),
    start: t.field({ type: "DateTime", resolve: (s) => s.start }),
    end: t.field({ type: "DateTime", resolve: (s) => s.end }),
  }),
});

const PanchangTimelineRef = builder.objectRef<PanchangTimelineView>("PanchangTimeline").implement({
  description:
    "The full sunrise-to-next-sunrise day, broken into every segment each anga occupies — the data a day-chart view needs, as opposed to `panchang`'s single sunrise/instant snapshot.",
  fields: (t) => ({
    date: t.exposeString("date"),
    timezone: t.exposeString("timezone"),
    location: t.field({ type: PanchangLocationRef, resolve: (p) => p.location }),
    sunrise: t.field({ type: "DateTime", resolve: (p) => p.sunrise }),
    sunset: t.field({ type: "DateTime", resolve: (p) => p.sunset }),
    nextSunrise: t.field({ type: "DateTime", resolve: (p) => p.nextSunrise }),
    moonrise: t.field({ type: "DateTime", nullable: true, resolve: (p) => p.moonrise }),
    moonset: t.field({ type: "DateTime", nullable: true, resolve: (p) => p.moonset }),
    vara: t.field({ type: LocalizedStringRef, resolve: (p) => p.vara }),
    tithiSegments: t.field({ type: [PanchangSegmentRef], resolve: (p) => p.tithiSegments }),
    nakshatraSegments: t.field({ type: [PanchangSegmentRef], resolve: (p) => p.nakshatraSegments }),
    yogaSegments: t.field({ type: [PanchangSegmentRef], resolve: (p) => p.yogaSegments }),
    karanaSegments: t.field({ type: [PanchangSegmentRef], resolve: (p) => p.karanaSegments }),
    auspiciousPeriods: t.field({ type: [PanchangKaalaRef], resolve: (p) => p.auspiciousPeriods }),
    inauspiciousPeriods: t.field({ type: [PanchangKaalaRef], resolve: (p) => p.inauspiciousPeriods }),
  }),
});

const PanchangDayTithiRef = builder
  .objectRef<PanchangDayView["tithi"]>("PanchangDayTithi")
  .implement({
    fields: (t) => ({
      index: t.exposeInt("index", { description: "1–15 Shukla, 16–30 Krishna (30 = Amavasya)." }),
      name: t.field({ type: LocalizedStringRef, resolve: (x) => x.name }),
      end: t.field({ type: "DateTime", resolve: (x) => x.end }),
    }),
  });

const PanchangDayRef = builder.objectRef<PanchangDayView>("PanchangDay").implement({
  description: "One day of a month calendar, as it stands at sunrise.",
  fields: (t) => ({
    date: t.exposeString("date"),
    vara: t.field({ type: LocalizedStringRef, resolve: (d) => d.vara }),
    tithi: t.field({ type: PanchangDayTithiRef, resolve: (d) => d.tithi }),
    paksha: t.field({ type: LocalizedStringRef, resolve: (d) => d.paksha }),
    nakshatra: t.field({ type: LocalizedStringRef, resolve: (d) => d.nakshatra }),
    masa: t.field({ type: LocalizedStringRef, resolve: (d) => d.masa }),
    sunrise: t.field({ type: "DateTime", resolve: (d) => d.sunrise }),
    sunset: t.field({ type: "DateTime", resolve: (d) => d.sunset }),
    moonrise: t.field({ type: "DateTime", nullable: true, resolve: (d) => d.moonrise }),
    observances: t.field({ type: [PanchangObservanceRef], resolve: (d) => d.observances }),
  }),
});

const PanchangMonthRef = builder.objectRef<PanchangMonthView>("PanchangMonth").implement({
  fields: (t) => ({
    year: t.exposeInt("year"),
    month: t.exposeInt("month"),
    timezone: t.exposeString("timezone"),
    location: t.field({ type: PanchangLocationRef, resolve: (m) => m.location }),
    days: t.field({ type: [PanchangDayRef], resolve: (m) => m.days }),
  }),
});

const PanchangPlaceRef = builder.objectRef<PlaceView>("PanchangPlace").implement({
  description: "A town or city with coordinates and timezone (GeoNames, CC BY 4.0).",
  fields: (t) => ({
    name: t.exposeString("name"),
    nameHi: t.exposeString("nameHi", { nullable: true }),
    region: t.exposeString("region", { nullable: true }),
    country: t.exposeString("country", { description: "ISO 3166 alpha-2 code." }),
    countryName: t.exposeString("countryName"),
    latitude: t.exposeFloat("latitude"),
    longitude: t.exposeFloat("longitude"),
    timezone: t.exposeString("timezone"),
  }),
});

export function registerPanchangModule() {
  builder.queryFields((t) => ({
    panchang: t.field({
      type: PanchangRef,
      description:
        "Today's panchang (or `date`'s) for a location. All args are optional; unset location falls back to the server's configured default (New Delhi).",
      args: {
        date: t.arg.string({
          required: false,
          description: "Civil date as yyyy-mm-dd. Defaults to today in `timezone`.",
        }),
        time: t.arg.string({
          required: false,
          description:
            "Wall-clock time of day as HH:MM or HH:MM:SS (24-hour), read in `timezone`. When set, the aṅgas, sidereal signs and `fractionElapsed` are measured at that instant instead of at sunrise, and `currentPeriods` is populated. Use for a birth time or a \"right now\" lookup.",
        }),
        latitude: t.arg.float({ required: false, description: "North positive. Default from server config." }),
        longitude: t.arg.float({ required: false, description: "East positive. Default from server config." }),
        timezone: t.arg.string({ required: false, description: "IANA timezone id. Default Asia/Kolkata." }),
        monthSystem: t.arg({ type: MonthSystemEnum, required: false, description: "Drives `masa`. Default amanta." }),
      },
      resolve: (_parent, args) =>
        getPanchang({
          date: args.date,
          time: args.time,
          latitude: args.latitude,
          longitude: args.longitude,
          timezone: args.timezone,
          monthSystem: args.monthSystem,
        }),
    }),

    panchangMonth: t.field({
      type: PanchangMonthRef,
      description: "Every day of a Gregorian month at a place (at sunrise), with vrats and festivals. Location defaults to New Delhi.",
      args: {
        year: t.arg.int({ required: true }),
        month: t.arg.int({ required: true, description: "1–12" }),
        latitude: t.arg.float({ required: false }),
        longitude: t.arg.float({ required: false }),
        timezone: t.arg.string({ required: false }),
        monthSystem: t.arg({ type: MonthSystemEnum, required: false }),
      },
      resolve: (_parent, args) => getPanchangMonth(args),
    }),

    panchangPlaces: t.field({
      type: [PanchangPlaceRef],
      description: "Search towns and cities by name (English or Devanagari) — for picking a panchang location.",
      args: {
        query: t.arg.string({ required: true }),
        limit: t.arg.int({ required: false, description: "Default 8, max 20." }),
      },
      resolve: (_parent, { query, limit }) => searchPlaces(query, limit ?? 8),
    }),

    panchangNearestPlace: t.field({
      type: PanchangPlaceRef,
      nullable: true,
      description: "The listed town nearest to a point, e.g. the visitor's device location. Null when nothing is within ~150 km.",
      args: {
        latitude: t.arg.float({ required: true }),
        longitude: t.arg.float({ required: true }),
      },
      resolve: (_parent, { latitude, longitude }) => nearestPlace(latitude, longitude),
    }),

    panchangTimeline: t.field({
      type: PanchangTimelineRef,
      description:
        "The full sunrise-to-next-sunrise day for a location, broken into every segment each anga occupies — for a day-chart view. All args are optional; unset location falls back to the server's configured default (New Delhi).",
      args: {
        date: t.arg.string({
          required: false,
          description: "Civil date as yyyy-mm-dd. Defaults to today in `timezone`.",
        }),
        latitude: t.arg.float({ required: false, description: "North positive. Default from server config." }),
        longitude: t.arg.float({ required: false, description: "East positive. Default from server config." }),
        timezone: t.arg.string({ required: false, description: "IANA timezone id. Default Asia/Kolkata." }),
        monthSystem: t.arg({ type: MonthSystemEnum, required: false, description: "Default amanta." }),
      },
      resolve: (_parent, args) =>
        getPanchangTimeline({
          date: args.date,
          latitude: args.latitude,
          longitude: args.longitude,
          timezone: args.timezone,
          monthSystem: args.monthSystem,
        }),
    }),
  }));
}
