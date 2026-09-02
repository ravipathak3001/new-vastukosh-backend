import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import {
  getPanchang,
  type PanchangView,
  type PanchangAngaView,
  type PanchangKaalaView,
  type PanchangReferenceView,
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
    currentPeriods: t.field({
      type: [PanchangKaalaRef],
      resolve: (p) => p.currentPeriods,
      description:
        "Auspicious/inauspicious windows containing `reference.instant`. Empty in sunrise mode; the \"what's running now\" answer when `time` is given.",
    }),
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
  }));
}
