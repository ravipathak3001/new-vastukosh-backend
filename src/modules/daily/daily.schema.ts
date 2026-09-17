import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import type {
  DailyCardDoc,
  DailyMantraDoc,
  DailyVerseDoc,
} from "./daily.model.js";
import { dailyCards, dailyMantra, dailyVerse } from "./daily.service.js";

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

export function registerDailyModule() {
  builder.queryFields((t) => ({
    dailyMantra: t.field({
      type: DailyMantraRef,
      nullable: true,
      resolve: () => dailyMantra(),
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
