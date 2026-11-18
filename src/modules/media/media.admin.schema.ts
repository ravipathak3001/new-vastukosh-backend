import { builder } from "../../graphql/builder.js";
import type { Paged } from "../../graphql/admin-common.js";
import { env } from "../../config/env.js";
import { MEDIA_FOLDERS, type MediaAssetDoc } from "./media.model.js";
import { ACCEPTED_IMAGE_TYPES, deleteMedia, getMedia, findMediaUsage, listMedia, updateMedia, type MediaUsage } from "./media.service.js";

/**
 * Media library — admin only. Uploading is a plain HTTP endpoint
 * (`POST /media/upload`, see `media.routes.ts`) because GraphQL is a poor fit
 * for file bodies; everything else (browse, rename, re-file, delete) is here.
 */

const MediaFolderEnum = builder.enumType("MediaFolder", { values: MEDIA_FOLDERS });

const MediaUsageRef = builder.objectRef<MediaUsage>("MediaUsage").implement({
  fields: (t) => ({
    kind: t.exposeString("kind", { nullable: false }),
    label: t.exposeString("label", { nullable: false }),
    ref: t.exposeString("ref", { nullable: false }),
  }),
});

const MediaAssetRef = builder.objectRef<MediaAssetDoc>("MediaAsset").implement({
  fields: (t) => ({
    id: t.id({ nullable: false, resolve: (a) => String(a._id) }),
    url: t.exposeString("url", { nullable: false }),
    filename: t.exposeString("filename", { nullable: false }),
    contentType: t.exposeString("contentType", { nullable: false }),
    size: t.exposeInt("size", { nullable: false }),
    width: t.int({ nullable: true, resolve: (a) => a.width ?? null }),
    height: t.int({ nullable: true, resolve: (a) => a.height ?? null }),
    folder: t.field({ nullable: false, type: MediaFolderEnum, resolve: (a) => a.folder as (typeof MEDIA_FOLDERS)[number] }),
    alt: t.string({ nullable: false, resolve: (a) => a.alt ?? "" }),
    storage: t.exposeString("storage", { nullable: false }),
    createdAt: t.field({ nullable: false, type: "DateTime", resolve: (a) => a.createdAt as Date }),
    /** Products, collections, testimonials… currently showing this image. */
    usage: t.field({ nullable: false, type: [MediaUsageRef], resolve: (a) => findMediaUsage(a.url) }),
  }),
});

const AdminMediaPage = builder.objectRef<Paged<MediaAssetDoc>>("AdminMediaPage").implement({
  fields: (t) => ({
    items: t.field({ nullable: false, type: [MediaAssetRef], resolve: (p) => p.items }),
    total: t.exposeInt("total", { nullable: false }),
    page: t.exposeInt("page", { nullable: false }),
    pageSize: t.exposeInt("pageSize", { nullable: false }),
  }),
});

const MediaSettingsRef = builder
  .objectRef<{ storage: string; maxBytes: number; acceptedTypes: string[] }>("MediaSettings")
  .implement({
    fields: (t) => ({
      storage: t.exposeString("storage", { nullable: false }),
      maxBytes: t.exposeInt("maxBytes", { nullable: false }),
      acceptedTypes: t.exposeStringList("acceptedTypes", { nullable: false }),
    }),
  });

const UpdateMediaAssetInput = builder.inputType("UpdateMediaAssetInput", {
  fields: (t) => ({
    filename: t.string({ required: false }),
    alt: t.string({ required: false }),
    folder: t.field({ type: MediaFolderEnum, required: false }),
  }),
});

export function registerMediaAdminModule() {
  builder.queryFields((t) => ({
    adminMedia: t.field({
      type: AdminMediaPage,
      nullable: false,
      authScopes: { permission: "media.view" },
      args: {
        search: t.arg.string({ required: false }),
        folder: t.arg({ type: MediaFolderEnum, required: false }),
        page: t.arg.int({ required: false }),
        pageSize: t.arg.int({ required: false }),
      },
      resolve: (_root, args) => listMedia(args),
    }),
    adminMediaAsset: t.field({
      type: MediaAssetRef,
      nullable: true,
      authScopes: { permission: "media.view" },
      args: { id: t.arg.id({ required: true }) },
      resolve: (_root, { id }) => getMedia(id),
    }),
    adminMediaSettings: t.field({
      type: MediaSettingsRef,
      nullable: false,
      authScopes: { permission: "media.view" },
      resolve: () => ({
        storage: env.MEDIA_STORAGE,
        maxBytes: Math.floor(env.MEDIA_MAX_MB * 1024 * 1024),
        acceptedTypes: ACCEPTED_IMAGE_TYPES,
      }),
    }),
  }));

  builder.mutationFields((t) => ({
    updateMediaAsset: t.field({
      type: MediaAssetRef,
      nullable: false,
      authScopes: { permission: "media.manage" },
      args: {
        id: t.arg.id({ required: true }),
        input: t.arg({ type: UpdateMediaAssetInput, required: true }),
      },
      resolve: (_root, { id, input }) => updateMedia(id, input),
    }),
    deleteMediaAsset: t.boolean({
      nullable: false,
      authScopes: { permission: "media.manage" },
      args: {
        id: t.arg.id({ required: true }),
        /** Delete even though products / pages still show it (they'll show a broken image). */
        force: t.arg.boolean({ required: false }),
      },
      resolve: (_root, { id, force }) => deleteMedia(id, force ?? false),
    }),
  }));
}
