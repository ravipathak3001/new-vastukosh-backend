import { builder } from "../../graphql/builder.js";
import { DailyCardRef, DailyMantraRef, DailyVerseRef } from "./daily.schema.js";
import {
  deleteCard,
  deleteMantra,
  deleteVerse,
  listCardsForAdmin,
  listMantrasForAdmin,
  listVersesForAdmin,
  upsertCard,
  upsertMantra,
  upsertVerse,
} from "./daily.service.js";

const DailyMantraInput = builder.inputType("DailyMantraInput", {
  fields: (t) => ({
    key: t.string({ required: true }),
    title: t.field({ type: "JSON", required: false }),
    deity: t.string({ required: false }),
    sanskrit: t.string({ required: false }),
    transliteration: t.string({ required: false }),
    meaning: t.field({ type: "JSON", required: false }),
    audioUrl: t.string({ required: false }),
    durationSeconds: t.int({ required: false }),
    artwork: t.string({ required: false }),
    date: t.string({ required: false }),
    order: t.int({ required: false }),
    published: t.boolean({ required: false }),
  }),
});

const DailyVerseInput = builder.inputType("DailyVerseInput", {
  fields: (t) => ({
    key: t.string({ required: true }),
    sanskrit: t.string({ required: false }),
    transliteration: t.string({ required: false }),
    meaning: t.field({ type: "JSON", required: false }),
    source: t.string({ required: false }),
    date: t.string({ required: false }),
    order: t.int({ required: false }),
    published: t.boolean({ required: false }),
  }),
});

const DailyCardInput = builder.inputType("DailyCardInput", {
  fields: (t) => ({
    key: t.string({ required: true }),
    title: t.field({ type: "JSON", required: false }),
    caption: t.field({ type: "JSON", required: false }),
    imageUrl: t.string({ required: false }),
    date: t.string({ required: false }),
    order: t.int({ required: false }),
    published: t.boolean({ required: false }),
  }),
});

export function registerDailyAdminModule() {
  builder.queryFields((t) => ({
    adminDailyMantras: t.field({
      type: [DailyMantraRef],
      authScopes: { permission: "daily.view" },
      resolve: () => listMantrasForAdmin(),
    }),
    adminDailyVerses: t.field({
      type: [DailyVerseRef],
      authScopes: { permission: "daily.view" },
      resolve: () => listVersesForAdmin(),
    }),
    adminDailyCards: t.field({
      type: [DailyCardRef],
      authScopes: { permission: "daily.view" },
      resolve: () => listCardsForAdmin(),
    }),
  }));

  builder.mutationFields((t) => ({
    upsertDailyMantra: t.field({
      type: DailyMantraRef,
      authScopes: { permission: "daily.manage" },
      args: { input: t.arg({ type: DailyMantraInput, required: true }) },
      resolve: (_p, { input }) => upsertMantra(input as never),
    }),
    deleteDailyMantra: t.field({
      type: "Boolean",
      authScopes: { permission: "daily.manage" },
      args: { key: t.arg.string({ required: true }) },
      resolve: (_p, { key }) => deleteMantra(key),
    }),

    upsertDailyVerse: t.field({
      type: DailyVerseRef,
      authScopes: { permission: "daily.manage" },
      args: { input: t.arg({ type: DailyVerseInput, required: true }) },
      resolve: (_p, { input }) => upsertVerse(input as never),
    }),
    deleteDailyVerse: t.field({
      type: "Boolean",
      authScopes: { permission: "daily.manage" },
      args: { key: t.arg.string({ required: true }) },
      resolve: (_p, { key }) => deleteVerse(key),
    }),

    upsertDailyCard: t.field({
      type: DailyCardRef,
      authScopes: { permission: "daily.manage" },
      args: { input: t.arg({ type: DailyCardInput, required: true }) },
      resolve: (_p, { input }) => upsertCard(input as never),
    }),
    deleteDailyCard: t.field({
      type: "Boolean",
      authScopes: { permission: "daily.manage" },
      args: { key: t.arg.string({ required: true }) },
      resolve: (_p, { key }) => deleteCard(key),
    }),
  }));
}
