import { builder } from "../../graphql/builder.js";
import { resolvePaging, paged, type Paged } from "../../graphql/admin-common.js";
import type { ContactSubmissionDoc, NewsletterSubscriberDoc } from "./marketing.model.js";
import {
  listContactSubmissionsForAdmin,
  listSubscribersForAdmin,
  updateContactStatus,
  updateSubscriberStatus,
} from "./marketing.service.js";

const ContactStatusEnum = builder.enumType("ContactStatus", {
  values: ["new", "read", "responded"] as const,
});

const SubscriberStatusEnum = builder.enumType("SubscriberStatus", {
  values: ["subscribed", "unsubscribed"] as const,
});

const ContactSubmissionRef = builder
  .objectRef<ContactSubmissionDoc>("ContactSubmission")
  .implement({
    fields: (t) => ({
      id: t.field({ type: "ID", resolve: (c) => String(c._id) }),
      name: t.exposeString("name"),
      email: t.exposeString("email"),
      phone: t.exposeString("phone"),
      subject: t.exposeString("subject"),
      message: t.exposeString("message"),
      status: t.field({ type: ContactStatusEnum, resolve: (c) => c.status as never }),
      locale: t.exposeString("locale"),
      createdAt: t.field({ type: "DateTime", resolve: (c) => (c as any).createdAt }),
    }),
  });

const NewsletterSubscriberRef = builder
  .objectRef<NewsletterSubscriberDoc>("NewsletterSubscriber")
  .implement({
    fields: (t) => ({
      id: t.field({ type: "ID", resolve: (s) => String(s._id) }),
      email: t.exposeString("email"),
      locale: t.exposeString("locale"),
      status: t.field({ type: SubscriberStatusEnum, resolve: (s) => s.status as never }),
      source: t.exposeString("source"),
      createdAt: t.field({ type: "DateTime", resolve: (s) => (s as any).createdAt }),
    }),
  });

const AdminContactFilterInput = builder.inputType("AdminContactFilterInput", {
  fields: (t) => ({
    status: t.field({ type: ContactStatusEnum, required: false }),
    search: t.string({ required: false }),
  }),
});

const AdminContactPage = builder
  .objectRef<Paged<ContactSubmissionDoc>>("AdminContactPage")
  .implement({
    fields: (t) => ({
      items: t.field({ type: [ContactSubmissionRef], resolve: (p) => p.items }),
      total: t.exposeInt("total"),
      page: t.exposeInt("page"),
      pageSize: t.exposeInt("pageSize"),
    }),
  });

const AdminSubscriberFilterInput = builder.inputType("AdminSubscriberFilterInput", {
  fields: (t) => ({
    status: t.field({ type: SubscriberStatusEnum, required: false }),
    search: t.string({ required: false }),
  }),
});

const AdminSubscriberPage = builder
  .objectRef<Paged<NewsletterSubscriberDoc>>("AdminSubscriberPage")
  .implement({
    fields: (t) => ({
      items: t.field({ type: [NewsletterSubscriberRef], resolve: (p) => p.items }),
      total: t.exposeInt("total"),
      page: t.exposeInt("page"),
      pageSize: t.exposeInt("pageSize"),
    }),
  });

export function registerMarketingAdminModule() {
  builder.queryFields((t) => ({
    adminContactSubmissions: t.field({
      type: AdminContactPage,
      authScopes: { permission: "marketing.view" },
      args: {
        filter: t.arg({ type: AdminContactFilterInput, required: false }),
        page: t.arg.int({ required: false }),
        pageSize: t.arg.int({ required: false }),
      },
      resolve: async (_p, args) => {
        const { page, pageSize, skip, limit } = resolvePaging(args);
        const { items, total } = await listContactSubmissionsForAdmin(
          { status: args.filter?.status ?? null, search: args.filter?.search ?? null },
          skip,
          limit,
        );
        return paged(items, total, { page, pageSize });
      },
    }),

    adminNewsletterSubscribers: t.field({
      type: AdminSubscriberPage,
      authScopes: { permission: "marketing.view" },
      args: {
        filter: t.arg({ type: AdminSubscriberFilterInput, required: false }),
        page: t.arg.int({ required: false }),
        pageSize: t.arg.int({ required: false }),
      },
      resolve: async (_p, args) => {
        const { page, pageSize, skip, limit } = resolvePaging(args);
        const { items, total } = await listSubscribersForAdmin(
          { status: args.filter?.status ?? null, search: args.filter?.search ?? null },
          skip,
          limit,
        );
        return paged(items, total, { page, pageSize });
      },
    }),
  }));

  builder.mutationFields((t) => ({
    updateContactStatus: t.field({
      type: ContactSubmissionRef,
      authScopes: { permission: "marketing.manage" },
      args: {
        id: t.arg.id({ required: true }),
        status: t.arg({ type: ContactStatusEnum, required: true }),
      },
      resolve: (_p, { id, status }) => updateContactStatus(String(id), status),
    }),

    updateSubscriberStatus: t.field({
      type: NewsletterSubscriberRef,
      authScopes: { permission: "marketing.manage" },
      args: {
        email: t.arg.string({ required: true }),
        status: t.arg({ type: SubscriberStatusEnum, required: true }),
      },
      resolve: (_p, { email, status }) => updateSubscriberStatus(email, status),
    }),
  }));
}
