import { builder } from "../../graphql/builder.js";
import { notFound } from "../../shared/errors.js";
import { notifyFrontendRevalidate } from "../../shared/http/revalidate-client.js";
import { SiteSettingsModel, RedirectModel } from "./site-settings.model.js";
import { AnnouncementModel } from "./announcement.model.js";
import { AnnouncementRef, RedirectRef, SiteSettingsRef } from "./seo.schema.js";

const SocialLinkInput = builder.inputType("SocialLinkInput", {
  fields: (t) => ({
    label: t.string({ required: true }),
    href: t.string({ required: true }),
    icon: t.string({ required: false }),
  }),
});

const SiteSettingsInput = builder.inputType("SiteSettingsInput", {
  fields: (t) => ({
    name: t.string({ required: false }),
    legalName: t.string({ required: false }),
    domain: t.string({ required: false }),
    logoUrl: t.string({ required: false }),
    email: t.string({ required: false }),
    phone: t.string({ required: false }),
    addressText: t.string({ required: false }),
    socials: t.field({ type: [SocialLinkInput], required: false }),
    sameAs: t.stringList({ required: false }),
  }),
});

const RedirectInput = builder.inputType("RedirectInput", {
  fields: (t) => ({
    from: t.string({ required: true }),
    to: t.string({ required: true }),
    statusCode: t.int({ required: false }),
  }),
});

const AnnouncementInput = builder.inputType("AnnouncementInput", {
  fields: (t) => ({
    enabled: t.boolean({ required: false }),
    text: t.field({ type: "JSON", required: false }),
    linkHref: t.string({ required: false }),
    linkLabel: t.field({ type: "JSON", required: false }),
  }),
});

export function registerSeoAdminModule() {
  builder.mutationFields((t) => ({
    updateSiteSettings: t.field({
      type: SiteSettingsRef,
      authScopes: { admin: true },
      args: { input: t.arg({ type: SiteSettingsInput, required: true }) },
      resolve: async (_p, { input }) => {
        const doc = await SiteSettingsModel.findOneAndUpdate(
          { key: "default" },
          { $set: input },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        await notifyFrontendRevalidate(["site-settings"]);
        return doc;
      },
    }),

    upsertRedirect: t.field({
      type: RedirectRef,
      authScopes: { admin: true },
      args: { input: t.arg({ type: RedirectInput, required: true }) },
      resolve: (_p, { input }) =>
        RedirectModel.findOneAndUpdate(
          { from: input.from },
          { $set: input },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        ),
    }),

    deleteRedirect: t.field({
      type: "Boolean",
      authScopes: { admin: true },
      args: { from: t.arg.string({ required: true }) },
      resolve: async (_p, { from }) => {
        const doc = await RedirectModel.findOneAndDelete({ from });
        if (!doc) throw notFound("Redirect");
        return true;
      },
    }),

    updateAnnouncementBar: t.field({
      type: AnnouncementRef,
      authScopes: { admin: true },
      args: { input: t.arg({ type: AnnouncementInput, required: true }) },
      resolve: async (_p, { input }) => {
        const doc = await AnnouncementModel.findOneAndUpdate(
          { key: "default" },
          { $set: input },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        await notifyFrontendRevalidate(["content", "layout"]);
        return doc;
      },
    }),
  }));
}
