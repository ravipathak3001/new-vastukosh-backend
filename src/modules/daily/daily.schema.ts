import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import type {
  DailyCardDoc,
  DailyMantraDoc,
  DailyVastuTipDoc,
  DailyVerseDoc,
} from "./daily.model.js";
import {
  dailyCards,
  dailyMantra,
  dailyVastuTip,
  dailyVerse,
  publishedMantras,
  publishedVastuTips,
} from "./daily.service.js";

export const DailyMantraRef = builder
  .objectRef<DailyMantraDoc>("DailyMantra")
  .implement({
    fields: (t) => ({
      id: t.field({ type: "ID", resolve: (d) => String(d._id) }),
      key: t.exposeString("key"),
      title: t.field({ type: LocalizedStringRef, resolve: (d) => d.title }),
      deity: t.exposeString("deity", { nullable: true }),
      sanskrit: t.exposeString("sanskrit", { nullable: true }),
      transliteration: t.exposeString("transliteration", { nullable: true }),
      meaning: t.field({ type: LocalizedStringRef, resolve: (d) => d.meaning }),
      audioUrl: t.exposeString("audioUrl", { nullable: true }),
      durationSeconds: t.exposeInt("durationSeconds", { nullable: true }),
      artwork: t.exposeString("artwork", { nullable: true }),
      weekday: t.int({
        nullable: true,
        description: "0 = Sunday … 6 = Saturday — the weekday this mantra is shown on, if any.",
        resolve: (d) => d.weekday ?? null,
      }),
      date: t.exposeString("date", { nullable: true }),
      published: t.exposeBoolean("published", {
        authScopes: { permission: "daily.view" },
      }),
      order: t.exposeInt("order", { authScopes: { permission: "daily.view" } }),
    }),
  });

export const DailyVerseRef = builder
  .objectRef<DailyVerseDoc>("DailyVerse")
  .implement({
    fields: (t) => ({
      id: t.field({ type: "ID", resolve: (d) => String(d._id) }),
      key: t.exposeString("key"),
      sanskrit: t.exposeString("sanskrit"),
      transliteration: t.exposeString("transliteration", { nullable: true }),
      meaning: t.field({ type: LocalizedStringRef, resolve: (d) => d.meaning }),
      source: t.exposeString("source", { nullable: true }),
      date: t.exposeString("date", { nullable: true }),
      published: t.exposeBoolean("published", {
        authScopes: { permission: "daily.view" },
      }),
      order: t.exposeInt("order", { authScopes: { permission: "daily.view" } }),
    }),
  });

export const DailyCardRef = builder
  .objectRef<DailyCardDoc>("DailyCard")
  .implement({
    fields: (t) => ({
      id: t.field({ type: "ID", resolve: (d) => String(d._id) }),
      key: t.exposeString("key"),
      title: t.field({ type: LocalizedStringRef, resolve: (d) => d.title }),
      caption: t.field({ type: LocalizedStringRef, resolve: (d) => d.caption }),
      imageUrl: t.exposeString("imageUrl"),
      date: t.exposeString("date", { nullable: true }),
      published: t.exposeBoolean("published", {
        authScopes: { permission: "daily.view" },
      }),
      order: t.exposeInt("order", { authScopes: { permission: "daily.view" } }),
    }),
  });

export const DailyVastuTipRef = builder
  .objectRef<DailyVastuTipDoc>("DailyVastuTip")
  .implement({
    fields: (t) => ({
      id: t.field({ type: "ID", resolve: (d) => String(d._id) }),
      key: t.exposeString("key"),
      area: t.field({ type: LocalizedStringRef, resolve: (d) => d.area }),
      title: t.field({ type: LocalizedStringRef, resolve: (d) => d.title }),
      body: t.field({ type: LocalizedStringRef, resolve: (d) => d.body }),
      icon: t.exposeString("icon", { nullable: true }),
      image: t.exposeString("image", { nullable: true }),
      date: t.exposeString("date", { nullable: true }),
      published: t.exposeBoolean("published", {
        authScopes: { permission: "daily.view" },
      }),
      order: t.exposeInt("order", { authScopes: { permission: "daily.view" } }),
    }),
  });

export function registerDailyModule() {
  builder.queryFields((t) => ({
    dailyMantra: t.field({
      type: DailyMantraRef,
      nullable: true,
      resolve: () => dailyMantra(),
    }),
    dailyMantras: t.field({
      type: [DailyMantraRef],
      description: "All published mantras — weekday ones first (Sunday → Saturday).",
      resolve: () => publishedMantras(),
    }),
    dailyVastuTip: t.field({
      type: DailyVastuTipRef,
      nullable: true,
      resolve: () => dailyVastuTip(),
    }),
    vastuTips: t.field({
      type: [DailyVastuTipRef],
      resolve: () => publishedVastuTips(),
    }),
    dailyVerse: t.field({
      type: DailyVerseRef,
      nullable: true,
      resolve: () => dailyVerse(),
    }),
    dailyCards: t.field({
      type: [DailyCardRef],
      args: { limit: t.arg.int({ required: false }) },
      resolve: (_p, { limit }) => dailyCards(limit ?? 12),
    }),
  }));
}
